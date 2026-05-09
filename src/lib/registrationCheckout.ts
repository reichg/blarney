import { db } from "@/lib/db";
import {
  createRegistrationPaymentLink,
  getRegistrationPaymentLinkState,
  hasSquarePaymentConfiguration,
} from "@/lib/payment";
import {
  registrationCheckoutPayloadSchema,
  type CheckoutLogLevel,
  type RegistrationCheckoutConfirmationResult,
  type RegistrationCheckoutPayload,
  type RegistrationCheckoutPaymentResult,
  type RegistrationCheckoutRecord,
} from "@/lib/type";
import { Prisma } from "@prisma/client";
import { createHash, randomUUID } from "crypto";
export { registrationCheckoutPayloadSchema } from "@/lib/type";
export type {
  RegistrationCheckoutConfirmationResult,
  RegistrationCheckoutPayload,
  RegistrationCheckoutPaymentResult,
} from "@/lib/type";

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function getPaymentReferenceFingerprint(reference: string | null | undefined) {
  if (!reference) {
    return null;
  }

  if (reference.length <= 8) {
    return `${reference.slice(0, 2)}...${reference.slice(-2)}`;
  }

  return `${reference.slice(0, 4)}...${reference.slice(-4)}`;
}

function getErrorLogData(error: unknown) {
  let errorType: string = typeof error;
  let errorCode: string | null = null;
  let errorStatus: number | null = null;

  if (error && typeof error === "object") {
    if ("name" in error && typeof error.name === "string") {
      errorType = error.name;
    }

    if ("code" in error && typeof error.code === "string") {
      errorCode = error.code;
    }

    if ("status" in error && typeof error.status === "number") {
      errorStatus = error.status;
    }
  }

  return {
    errorType,
    errorCode,
    errorStatus,
  };
}

function logRegistrationCheckoutEvent(
  level: CheckoutLogLevel,
  event: string,
  details: Record<string, string | number | boolean | null | undefined>,
) {
  const logger =
    level === "error"
      ? console.error
      : level === "warn"
        ? console.warn
        : console.info;

  logger(`[registration-checkout] ${event}`, details);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  return `{${Object.entries(value)
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(",")}}`;
}

export function getRegistrationCheckoutIdempotencyKey(
  payload: RegistrationCheckoutPayload,
) {
  return createHash("sha256")
    .update(`registration-checkout:${stableStringify(payload)}`)
    .digest("hex");
}

function parseCheckoutPayload(payload: unknown) {
  return registrationCheckoutPayloadSchema.parse(payload);
}

function toCheckoutPayloadJson(payload: RegistrationCheckoutPayload) {
  return payload as unknown as Prisma.InputJsonValue;
}

function getRegistrationRsvpPartyCounts(payload: RegistrationCheckoutPayload) {
  const golferCounts = payload.golfers.reduce(
    (counts, golfer) => {
      if (golfer.age < 15) {
        return {
          adultAttendeeCount: counts.adultAttendeeCount,
          childAttendeeCount: counts.childAttendeeCount + 1,
        };
      }

      return {
        adultAttendeeCount: counts.adultAttendeeCount + 1,
        childAttendeeCount: counts.childAttendeeCount,
      };
    },
    { adultAttendeeCount: 0, childAttendeeCount: 0 },
  );

  return {
    adultAttendeeCount:
      golferCounts.adultAttendeeCount + payload.bbqOnlyAdultCount,
    childAttendeeCount:
      golferCounts.childAttendeeCount + payload.bbqOnlyKidCount,
  };
}

function getGolferFamilyNames(payload: RegistrationCheckoutPayload) {
  return payload.golfers
    .map((golfer) => `${golfer.firstName} ${golfer.lastName}`)
    .join(", ");
}

async function syncRegistrationRsvp(options: {
  transaction: Prisma.TransactionClient;
  participantId: string;
  payload: RegistrationCheckoutPayload;
}) {
  const { adultAttendeeCount, childAttendeeCount } =
    getRegistrationRsvpPartyCounts(options.payload);
  const attendeeCount = adultAttendeeCount + childAttendeeCount;

  const existingRsvp = await options.transaction.rsvp.findUnique({
    where: { email: options.payload.email },
    select: { id: true, participantId: true },
  });

  if (existingRsvp) {
    return;
  }

  await options.transaction.rsvp.create({
    data: {
      participantId: options.participantId,
      source: "REGISTRATION",
      firstName: options.payload.firstName,
      lastName: options.payload.lastName,
      email: options.payload.email,
      adultAttendeeCount,
      childAttendeeCount,
      attendeeCount,
      familyNames: getGolferFamilyNames(options.payload),
      dietaryNotes: options.payload.dietaryNotes,
      notes: options.payload.notes,
    },
  });
}

async function hasRegistrationIdentityConflict(email: string) {
  const confirmedRegistrationCheckout = await db.registrationCheckout.findFirst(
    {
      where: {
        email,
        status: "CONFIRMED",
      },
      select: { id: true },
    },
  );

  if (confirmedRegistrationCheckout) {
    return true;
  }

  const existingRegistration = await db.registration.findFirst({
    where: {
      participant: {
        email,
      },
    },
    select: { id: true },
  });

  if (existingRegistration) {
    return true;
  }

  const existingRsvp = await db.rsvp.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingRsvp) {
    return true;
  }

  const activeRsvpCheckout = await db.rsvpCheckout.findFirst({
    where: {
      email,
      status: { in: ["PENDING", "PAYMENT_REVIEW"] },
    },
    select: { id: true },
  });

  return Boolean(activeRsvpCheckout);
}

async function persistRecoveredRegistrationPaymentLink({
  checkout,
  paymentLink,
}: {
  checkout: RegistrationCheckoutRecord;
  paymentLink: {
    reference: string;
    orderId: string | null;
    url: string;
  };
}): Promise<RegistrationCheckoutPaymentResult> {
  const lastReconciledAt = new Date();
  const updateResult = await db.registrationCheckout.updateMany({
    where: {
      id: checkout.id,
      updatedAt: checkout.updatedAt,
      status: checkout.status,
      paymentReference: checkout.paymentReference,
    },
    data: {
      paymentReference: paymentLink.reference,
      paymentUrl: paymentLink.url,
      paymentOrderId: paymentLink.orderId,
      lastReconciledAt,
    },
  });

  if (updateResult.count === 1) {
    logRegistrationCheckoutEvent("info", "payment-link-recovery-persisted", {
      checkoutId: checkout.id,
      previousPaymentReferenceFingerprint: getPaymentReferenceFingerprint(
        checkout.paymentReference,
      ),
      paymentReferenceFingerprint: getPaymentReferenceFingerprint(
        paymentLink.reference,
      ),
      hasPaymentOrderId: Boolean(paymentLink.orderId),
    });

    return {
      ok: true,
      status: "pending",
      checkoutId: checkout.id,
      paymentReference: paymentLink.reference,
      paymentUrl: paymentLink.url,
    };
  }

  logRegistrationCheckoutEvent("warn", "payment-link-recovery-lost-race", {
    checkoutId: checkout.id,
    previousPaymentReferenceFingerprint: getPaymentReferenceFingerprint(
      checkout.paymentReference,
    ),
    paymentReferenceFingerprint: getPaymentReferenceFingerprint(
      paymentLink.reference,
    ),
  });

  const latestCheckout = await db.registrationCheckout.findUnique({
    where: { id: checkout.id },
  });

  if (!latestCheckout) {
    logRegistrationCheckoutEvent(
      "error",
      "payment-link-recovery-adoption-missing-checkout",
      {
        checkoutId: checkout.id,
      },
    );

    return { ok: false, reason: "unavailable" };
  }

  if (latestCheckout.status === "CONFIRMED" && latestCheckout.registrationId) {
    logRegistrationCheckoutEvent(
      "info",
      "payment-link-recovery-adopted-confirmed-checkout",
      {
        checkoutId: checkout.id,
        registrationId: latestCheckout.registrationId,
      },
    );

    return {
      ok: true,
      status: "confirmed",
      checkoutId: latestCheckout.id,
      registrationId: latestCheckout.registrationId,
      paymentUrl: null,
    };
  }

  if (latestCheckout.status === "PAYMENT_REVIEW") {
    logRegistrationCheckoutEvent(
      "info",
      "payment-link-recovery-adopted-review-checkout",
      {
        checkoutId: checkout.id,
      },
    );

    return { ok: false, reason: "review" };
  }

  if (
    latestCheckout.paymentReference &&
    latestCheckout.paymentUrl &&
    latestCheckout.paymentReference !== checkout.paymentReference
  ) {
    logRegistrationCheckoutEvent(
      "info",
      "payment-link-recovery-adopted-persisted-link",
      {
        checkoutId: checkout.id,
        previousPaymentReferenceFingerprint: getPaymentReferenceFingerprint(
          checkout.paymentReference,
        ),
        storedPaymentReferenceFingerprint: getPaymentReferenceFingerprint(
          latestCheckout.paymentReference,
        ),
      },
    );

    return {
      ok: true,
      status: "pending",
      checkoutId: latestCheckout.id,
      paymentReference: latestCheckout.paymentReference,
      paymentUrl: latestCheckout.paymentUrl,
    };
  }

  logRegistrationCheckoutEvent(
    "error",
    "payment-link-recovery-adoption-unavailable",
    {
      checkoutId: checkout.id,
      previousPaymentReferenceFingerprint: getPaymentReferenceFingerprint(
        checkout.paymentReference,
      ),
      storedPaymentReferenceFingerprint: getPaymentReferenceFingerprint(
        latestCheckout.paymentReference,
      ),
      currentStatus: latestCheckout.status,
    },
  );

  return { ok: false, reason: "unavailable" };
}

async function createOrReuseRegistrationCheckout(
  payload: RegistrationCheckoutPayload,
) {
  const idempotencyKey = getRegistrationCheckoutIdempotencyKey(payload);

  const activeEmailCheckout = await db.registrationCheckout.findFirst({
    where: {
      email: payload.email,
      status: { in: ["PENDING", "PAYMENT_REVIEW"] },
    },
    orderBy: { createdAt: "desc" },
  });

  if (activeEmailCheckout) {
    return activeEmailCheckout;
  }

  const existing = await db.registrationCheckout.findUnique({
    where: { idempotencyKey },
  });

  if (existing && existing.status !== "CONFIRMED") {
    return existing;
  }

  const createIdempotencyKey =
    existing && existing.status === "CONFIRMED"
      ? `${idempotencyKey}:${randomUUID()}`
      : idempotencyKey;

  return db.registrationCheckout.create({
    data: {
      idempotencyKey: createIdempotencyKey,
      email: payload.email,
      payload: toCheckoutPayloadJson(payload),
    },
  });
}

async function finalizeRegistrationCheckout(
  checkoutId: string,
): Promise<RegistrationCheckoutConfirmationResult> {
  try {
    return await db.$transaction(
      async (transaction) => {
        const checkout = await transaction.registrationCheckout.findUnique({
          where: { id: checkoutId },
        });

        if (!checkout) {
          return { ok: false, reason: "invalid" };
        }

        if (checkout.registrationId) {
          return { ok: true, registrationId: checkout.registrationId };
        }

        if (!checkout.paymentReference) {
          return { ok: false, reason: "invalid" };
        }

        const payload = parseCheckoutPayload(checkout.payload);
        const existingCheckoutRegistration =
          await transaction.registration.findFirst({
            where: { checkoutId: checkout.id },
            orderBy: { createdAt: "asc" },
            select: { id: true },
          });

        if (existingCheckoutRegistration) {
          await transaction.registrationCheckout.update({
            where: { id: checkout.id },
            data: {
              status: "CONFIRMED",
              confirmedAt: checkout.confirmedAt ?? new Date(),
              paymentCompletedAt: checkout.paymentCompletedAt ?? new Date(),
              paymentReviewReason: null,
              registrationId: existingCheckoutRegistration.id,
            },
          });

          return { ok: true, registrationId: existingCheckoutRegistration.id };
        }

        const existingConfirmedCheckout =
          await transaction.registrationCheckout.findFirst({
            where: {
              email: payload.email,
              status: "CONFIRMED",
              NOT: { id: checkout.id },
            },
            select: { id: true },
          });

        if (existingConfirmedCheckout) {
          return { ok: false, reason: "duplicate" };
        }

        const existingRegistration = await transaction.registration.findFirst({
          where: {
            participant: {
              email: payload.email,
            },
          },
          select: { id: true },
        });

        if (existingRegistration) {
          return { ok: false, reason: "duplicate" };
        }

        const existingRsvp = await transaction.rsvp.findUnique({
          where: { email: payload.email },
          select: { id: true },
        });

        if (existingRsvp) {
          return { ok: false, reason: "duplicate" };
        }

        let primaryRegistrationId: string | null = null;
        let primaryParticipantId: string | null = null;

        for (const [index, golfer] of payload.golfers.entries()) {
          const participant = await transaction.participant.create({
            data: {
              firstName: golfer.firstName,
              lastName: golfer.lastName,
              email: index === 0 ? payload.email : null,
              phone: payload.phone,
              gender: golfer.gender,
              age: golfer.age,
              averageScore: golfer.averageScore,
            },
          });

          const registration = await transaction.registration.create({
            data: {
              participantId: participant.id,
              checkoutId: checkout.id,
              packageSelection: payload.packageSelection,
              adultGuestCount: index === 0 ? payload.bbqOnlyAdultCount : 0,
              childGuestCount: index === 0 ? payload.bbqOnlyKidCount : 0,
              paymentStatus: "CONFIRMED",
              paymentReference: checkout.paymentReference,
              notes: payload.notes,
            },
          });

          primaryRegistrationId ??= registration.id;
          primaryParticipantId ??= participant.id;
        }

        if (!primaryRegistrationId || !primaryParticipantId) {
          return { ok: false, reason: "invalid" };
        }

        await syncRegistrationRsvp({
          transaction,
          participantId: primaryParticipantId,
          payload,
        });

        await transaction.registrationCheckout.update({
          where: { id: checkout.id },
          data: {
            status: "CONFIRMED",
            confirmedAt: new Date(),
            paymentCompletedAt: checkout.paymentCompletedAt ?? new Date(),
            paymentReviewReason: null,
            registrationId: primaryRegistrationId,
          },
        });

        return { ok: true, registrationId: primaryRegistrationId };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    const checkout = await db.registrationCheckout.findUnique({
      where: { id: checkoutId },
      select: { registrationId: true },
    });

    if (checkout?.registrationId) {
      return { ok: true, registrationId: checkout.registrationId };
    }

    if (isUniqueConstraintError(error)) {
      return { ok: false, reason: "duplicate" };
    }

    return { ok: false, reason: "unavailable" };
  }
}

async function markCheckoutPaymentReview(
  checkoutId: string,
  reason: string,
): Promise<RegistrationCheckoutConfirmationResult> {
  const checkout = await db.registrationCheckout.update({
    where: { id: checkoutId },
    data: {
      status: "PAYMENT_REVIEW",
      paymentReviewReason: reason,
      paymentCompletedAt: new Date(),
      lastReconciledAt: new Date(),
    },
    select: {
      registrationId: true,
    },
  });

  if (checkout.registrationId) {
    return { ok: true, registrationId: checkout.registrationId };
  }

  return { ok: false, reason: "review" };
}

async function finalizePaidCheckout(
  checkoutId: string,
  reviewReason: string,
): Promise<RegistrationCheckoutConfirmationResult> {
  await db.registrationCheckout.update({
    where: { id: checkoutId },
    data: {
      paymentCompletedAt: new Date(),
      lastReconciledAt: new Date(),
    },
  });

  const finalized = await finalizeRegistrationCheckout(checkoutId);

  if (finalized.ok) {
    return finalized;
  }

  if (finalized.reason === "duplicate" || finalized.reason === "unavailable") {
    return markCheckoutPaymentReview(checkoutId, reviewReason);
  }

  return finalized;
}

async function ensureRegistrationCheckoutPaymentLink(
  checkout: RegistrationCheckoutRecord,
): Promise<RegistrationCheckoutPaymentResult> {
  if (checkout.status === "CONFIRMED" && checkout.registrationId) {
    return {
      ok: true,
      status: "confirmed",
      checkoutId: checkout.id,
      registrationId: checkout.registrationId,
      paymentUrl: null,
    };
  }

  if (checkout.status === "PAYMENT_REVIEW") {
    return { ok: false, reason: "review" };
  }

  const payload = parseCheckoutPayload(checkout.payload);

  if (await hasRegistrationIdentityConflict(payload.email)) {
    return { ok: false, reason: "duplicate" };
  }

  if (!hasSquarePaymentConfiguration()) {
    return { ok: false, reason: "configuration" };
  }

  if (checkout.paymentReference) {
    let paymentLink;

    try {
      paymentLink = await getRegistrationPaymentLinkState(
        checkout.paymentReference,
      );
    } catch (error) {
      logRegistrationCheckoutEvent("error", "payment-resume-lookup-failed", {
        checkoutId: checkout.id,
        paymentReferenceFingerprint: getPaymentReferenceFingerprint(
          checkout.paymentReference,
        ),
        ...getErrorLogData(error),
      });

      return { ok: false, reason: "unavailable" };
    }

    if (!paymentLink) {
      logRegistrationCheckoutEvent(
        "warn",
        "payment-link-missing-recovery-started",
        {
          checkoutId: checkout.id,
          paymentReferenceFingerprint: getPaymentReferenceFingerprint(
            checkout.paymentReference,
          ),
        },
      );
    }

    if (paymentLink?.isComplete) {
      logRegistrationCheckoutEvent("info", "payment-link-reconcile-paid", {
        checkoutId: checkout.id,
        paymentReferenceFingerprint: getPaymentReferenceFingerprint(
          paymentLink.reference,
        ),
        orderState: paymentLink.orderState,
      });

      const finalized = await finalizePaidCheckout(
        checkout.id,
        "Square shows this checkout as paid, but local registration finalization did not complete.",
      );

      logRegistrationCheckoutEvent(
        finalized.ok ? "info" : "warn",
        "payment-link-reconcile-paid-finished",
        {
          checkoutId: checkout.id,
          outcome: finalized.ok ? "confirmed" : finalized.reason,
        },
      );

      if (finalized.ok) {
        return {
          ok: true,
          status: "confirmed",
          checkoutId: checkout.id,
          registrationId: finalized.registrationId,
          paymentUrl: null,
        };
      }

      const reason =
        finalized.reason === "duplicate" ||
        finalized.reason === "review" ||
        finalized.reason === "unavailable"
          ? finalized.reason
          : "unavailable";

      return {
        ok: false,
        reason,
      };
    }

    if (paymentLink?.url) {
      logRegistrationCheckoutEvent("info", "payment-link-reused", {
        checkoutId: checkout.id,
        paymentReferenceFingerprint: getPaymentReferenceFingerprint(
          paymentLink.reference,
        ),
        orderState: paymentLink.orderState,
        paymentUrlChanged: paymentLink.url !== checkout.paymentUrl,
        paymentOrderIdChanged:
          Boolean(paymentLink.orderId) &&
          paymentLink.orderId !== checkout.paymentOrderId,
      });

      const data: Prisma.RegistrationCheckoutUpdateInput = {};

      if (paymentLink.reference !== checkout.paymentReference) {
        data.paymentReference = paymentLink.reference;
      }

      if (paymentLink?.url && paymentLink.url !== checkout.paymentUrl) {
        data.paymentUrl = paymentLink.url;
      }

      if (paymentLink?.orderId) {
        data.paymentOrderId = paymentLink.orderId;
      }

      if (paymentLink) {
        data.lastReconciledAt = new Date();
      }

      if (Object.keys(data).length > 0) {
        await db.registrationCheckout.update({
          where: { id: checkout.id },
          data,
        });
      }

      return {
        ok: true,
        status: "pending",
        checkoutId: checkout.id,
        paymentReference: paymentLink.reference,
        paymentUrl: paymentLink.url,
      };
    }
  }

  let paymentLink;

  try {
    paymentLink = await createRegistrationPaymentLink({
      checkoutId: checkout.id,
      email: payload.email,
      golferCount: payload.golfers.length,
      bbqOnlyAdultCount: payload.bbqOnlyAdultCount,
      bbqOnlyKidCount: payload.bbqOnlyKidCount,
    });
  } catch (error) {
    logRegistrationCheckoutEvent(
      "error",
      "payment-link-recovery-create-failed",
      {
        checkoutId: checkout.id,
        previousPaymentReferenceFingerprint: getPaymentReferenceFingerprint(
          checkout.paymentReference,
        ),
        ...getErrorLogData(error),
      },
    );

    return { ok: false, reason: "unavailable" };
  }

  logRegistrationCheckoutEvent("info", "payment-link-recovery-created", {
    checkoutId: checkout.id,
    previousPaymentReferenceFingerprint: getPaymentReferenceFingerprint(
      checkout.paymentReference,
    ),
    paymentReferenceFingerprint: getPaymentReferenceFingerprint(
      paymentLink.reference,
    ),
    hasPaymentOrderId: Boolean(paymentLink.orderId),
  });

  if (!paymentLink.reference) {
    logRegistrationCheckoutEvent(
      "error",
      "payment-link-recovery-created-without-reference",
      {
        checkoutId: checkout.id,
        previousPaymentReferenceFingerprint: getPaymentReferenceFingerprint(
          checkout.paymentReference,
        ),
      },
    );

    return { ok: false, reason: "unavailable" };
  }

  return persistRecoveredRegistrationPaymentLink({
    checkout,
    paymentLink: {
      reference: paymentLink.reference,
      orderId: paymentLink.orderId,
      url: paymentLink.url,
    },
  });
}

export async function createRegistrationCheckoutPayment(
  payload: RegistrationCheckoutPayload,
) {
  const parsedPayload = registrationCheckoutPayloadSchema.parse(payload);

  if (await hasRegistrationIdentityConflict(parsedPayload.email)) {
    return { ok: false, reason: "duplicate" } as const;
  }

  const checkout = await createOrReuseRegistrationCheckout(parsedPayload);

  return ensureRegistrationCheckoutPaymentLink(checkout);
}

export async function getRegistrationCheckoutPayment(checkoutId: string) {
  const checkout = await db.registrationCheckout.findUnique({
    where: { id: checkoutId },
  });

  if (!checkout) {
    return { ok: false, reason: "not_found" } as const;
  }

  return ensureRegistrationCheckoutPaymentLink(checkout);
}

export async function confirmRegistrationCheckoutPayment(
  checkoutId: string,
): Promise<RegistrationCheckoutConfirmationResult> {
  const checkout = await db.registrationCheckout.findUnique({
    where: { id: checkoutId },
  });

  if (!checkout) {
    return { ok: false, reason: "invalid" };
  }

  if (checkout.status === "CONFIRMED" && checkout.registrationId) {
    return { ok: true, registrationId: checkout.registrationId };
  }

  if (checkout.status === "PAYMENT_REVIEW") {
    return { ok: false, reason: "review", paymentUrl: null };
  }

  if (!checkout.paymentReference) {
    return { ok: false, reason: "invalid" };
  }

  if (!hasSquarePaymentConfiguration()) {
    return {
      ok: false,
      reason: "unavailable",
      paymentUrl: checkout.paymentUrl,
    };
  }

  let paymentLink;

  try {
    paymentLink = await getRegistrationPaymentLinkState(
      checkout.paymentReference,
    );
  } catch (error) {
    logRegistrationCheckoutEvent(
      "error",
      "payment-confirmation-lookup-failed",
      {
        checkoutId: checkout.id,
        paymentReferenceFingerprint: getPaymentReferenceFingerprint(
          checkout.paymentReference,
        ),
        ...getErrorLogData(error),
      },
    );

    return {
      ok: false,
      reason: "pending",
      paymentUrl: checkout.paymentUrl,
    };
  }

  if (!paymentLink) {
    logRegistrationCheckoutEvent("warn", "payment-confirmation-link-missing", {
      checkoutId: checkout.id,
      paymentReferenceFingerprint: getPaymentReferenceFingerprint(
        checkout.paymentReference,
      ),
    });

    return { ok: false, reason: "invalid" };
  }

  if (paymentLink.orderId && paymentLink.orderId !== checkout.paymentOrderId) {
    await db.registrationCheckout.update({
      where: { id: checkout.id },
      data: {
        paymentOrderId: paymentLink.orderId,
        lastReconciledAt: new Date(),
      },
    });
  }

  if (!paymentLink.isComplete) {
    logRegistrationCheckoutEvent("info", "payment-confirmation-still-open", {
      checkoutId: checkout.id,
      paymentReferenceFingerprint: getPaymentReferenceFingerprint(
        paymentLink.reference,
      ),
      orderState: paymentLink.orderState,
    });

    return {
      ok: false,
      reason: "retry",
      paymentUrl: paymentLink.url ?? checkout.paymentUrl,
    };
  }

  logRegistrationCheckoutEvent("info", "payment-confirmation-paid", {
    checkoutId: checkout.id,
    paymentReferenceFingerprint: getPaymentReferenceFingerprint(
      paymentLink.reference,
    ),
    orderState: paymentLink.orderState,
  });

  const finalized = await finalizePaidCheckout(
    checkout.id,
    "Square return reconciliation showed this checkout as paid, but local registration finalization did not complete.",
  );

  logRegistrationCheckoutEvent(
    finalized.ok ? "info" : "warn",
    "payment-confirmation-finalized",
    {
      checkoutId: checkout.id,
      outcome: finalized.ok ? "confirmed" : finalized.reason,
    },
  );

  return finalized;
}

export async function confirmRegistrationCheckoutPaymentByOrderId(
  paymentOrderId: string,
): Promise<RegistrationCheckoutConfirmationResult> {
  const orderId = paymentOrderId.trim();

  if (!orderId) {
    return { ok: false, reason: "invalid" };
  }

  const checkout = await db.registrationCheckout.findUnique({
    where: { paymentOrderId: orderId },
  });

  if (!checkout) {
    return { ok: false, reason: "invalid" };
  }

  if (checkout.status === "CONFIRMED" && checkout.registrationId) {
    return { ok: true, registrationId: checkout.registrationId };
  }

  if (checkout.status === "PAYMENT_REVIEW") {
    return { ok: false, reason: "review", paymentUrl: null };
  }

  return finalizePaidCheckout(
    checkout.id,
    "Square webhook showed this checkout as paid, but local registration finalization did not complete.",
  );
}
