import { db } from "@/lib/db";
import {
  createRsvpPaymentLink,
  getRegistrationPaymentLinkState,
  hasSquarePaymentConfiguration,
} from "@/lib/payment";
import {
  rsvpCheckoutPayloadSchema,
  type CheckoutLogLevel,
  type RsvpCheckoutConfirmationResult,
  type RsvpCheckoutPayload,
  type RsvpCheckoutPaymentResult,
  type RsvpCheckoutRecord,
} from "@/lib/type";
import { Prisma } from "@prisma/client";
import { createHash, randomUUID } from "crypto";
export { rsvpCheckoutPayloadSchema } from "@/lib/type";
export type {
  RsvpCheckoutConfirmationResult,
  RsvpCheckoutPayload,
  RsvpCheckoutPaymentResult,
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

function logRsvpCheckoutEvent(
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

  logger(`[rsvp-checkout] ${event}`, details);
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

export function getRsvpCheckoutIdempotencyKey(payload: RsvpCheckoutPayload) {
  return createHash("sha256")
    .update(`rsvp-checkout:${stableStringify(payload)}`)
    .digest("hex");
}

function parseCheckoutPayload(payload: unknown) {
  return rsvpCheckoutPayloadSchema.parse(payload);
}

function toCheckoutPayloadJson(payload: RsvpCheckoutPayload) {
  return payload as unknown as Prisma.InputJsonValue;
}

async function hasRsvpIdentityConflict(email: string) {
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

  const activeRegistrationCheckout = await db.registrationCheckout.findFirst({
    where: {
      email,
      status: { in: ["PENDING", "PAYMENT_REVIEW"] },
    },
    select: { id: true },
  });

  return Boolean(activeRegistrationCheckout);
}

async function persistRecoveredRsvpPaymentLink({
  checkout,
  paymentLink,
}: {
  checkout: RsvpCheckoutRecord;
  paymentLink: {
    reference: string;
    orderId: string | null;
    url: string;
  };
}): Promise<RsvpCheckoutPaymentResult> {
  const lastReconciledAt = new Date();
  const updateResult = await db.rsvpCheckout.updateMany({
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
    logRsvpCheckoutEvent("info", "payment-link-recovery-persisted", {
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

  logRsvpCheckoutEvent("warn", "payment-link-recovery-lost-race", {
    checkoutId: checkout.id,
    previousPaymentReferenceFingerprint: getPaymentReferenceFingerprint(
      checkout.paymentReference,
    ),
    paymentReferenceFingerprint: getPaymentReferenceFingerprint(
      paymentLink.reference,
    ),
  });

  const latestCheckout = await db.rsvpCheckout.findUnique({
    where: { id: checkout.id },
  });

  if (!latestCheckout) {
    logRsvpCheckoutEvent(
      "error",
      "payment-link-recovery-adoption-missing-checkout",
      {
        checkoutId: checkout.id,
      },
    );

    return { ok: false, reason: "unavailable" };
  }

  if (latestCheckout.status === "CONFIRMED" && latestCheckout.rsvpId) {
    logRsvpCheckoutEvent(
      "info",
      "payment-link-recovery-adopted-confirmed-checkout",
      {
        checkoutId: checkout.id,
        rsvpId: latestCheckout.rsvpId,
      },
    );

    return {
      ok: true,
      status: "confirmed",
      checkoutId: latestCheckout.id,
      rsvpId: latestCheckout.rsvpId,
      paymentUrl: null,
    };
  }

  if (latestCheckout.status === "PAYMENT_REVIEW") {
    logRsvpCheckoutEvent(
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
    logRsvpCheckoutEvent(
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

  logRsvpCheckoutEvent("error", "payment-link-recovery-adoption-unavailable", {
    checkoutId: checkout.id,
    previousPaymentReferenceFingerprint: getPaymentReferenceFingerprint(
      checkout.paymentReference,
    ),
    storedPaymentReferenceFingerprint: getPaymentReferenceFingerprint(
      latestCheckout.paymentReference,
    ),
    currentStatus: latestCheckout.status,
  });

  return { ok: false, reason: "unavailable" };
}

async function createOrReuseRsvpCheckout(payload: RsvpCheckoutPayload) {
  const idempotencyKey = getRsvpCheckoutIdempotencyKey(payload);

  const activeEmailCheckout = await db.rsvpCheckout.findFirst({
    where: {
      email: payload.email,
      status: { in: ["PENDING", "PAYMENT_REVIEW"] },
    },
    orderBy: { createdAt: "desc" },
  });

  if (activeEmailCheckout) {
    return activeEmailCheckout;
  }

  const existing = await db.rsvpCheckout.findUnique({
    where: { idempotencyKey },
  });

  if (existing && existing.status !== "CONFIRMED") {
    return existing;
  }

  const createIdempotencyKey =
    existing && existing.status === "CONFIRMED"
      ? `${idempotencyKey}:${randomUUID()}`
      : idempotencyKey;

  return db.rsvpCheckout.create({
    data: {
      idempotencyKey: createIdempotencyKey,
      email: payload.email,
      payload: toCheckoutPayloadJson(payload),
    },
  });
}

async function finalizeRsvpCheckout(
  checkoutId: string,
): Promise<RsvpCheckoutConfirmationResult> {
  try {
    return await db.$transaction(
      async (transaction) => {
        const checkout = await transaction.rsvpCheckout.findUnique({
          where: { id: checkoutId },
        });

        if (!checkout) {
          return { ok: false, reason: "invalid" };
        }

        if (checkout.rsvpId) {
          return { ok: true, rsvpId: checkout.rsvpId };
        }

        if (!checkout.paymentReference) {
          return { ok: false, reason: "invalid" };
        }

        const payload = parseCheckoutPayload(checkout.payload);
        const confirmedRegistrationCheckout =
          await transaction.registrationCheckout.findFirst({
            where: {
              email: payload.email,
              status: "CONFIRMED",
            },
            select: { id: true },
          });

        if (confirmedRegistrationCheckout) {
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

        const participant = await transaction.participant.findUnique({
          where: { email: payload.email },
          select: { id: true },
        });
        const attendeeCount =
          payload.adultAttendeeCount + payload.childAttendeeCount;
        const rsvp = await transaction.rsvp.create({
          data: {
            participantId: participant?.id ?? null,
            source: "FORM",
            firstName: payload.firstName,
            lastName: payload.lastName,
            email: payload.email,
            adultAttendeeCount: payload.adultAttendeeCount,
            childAttendeeCount: payload.childAttendeeCount,
            attendeeCount,
            familyNames: payload.familyNames,
            dietaryNotes: payload.dietaryNotes,
            notes: payload.notes,
          },
        });

        await transaction.rsvpCheckout.update({
          where: { id: checkout.id },
          data: {
            status: "CONFIRMED",
            confirmedAt: new Date(),
            paymentCompletedAt: checkout.paymentCompletedAt ?? new Date(),
            paymentReviewReason: null,
            rsvpId: rsvp.id,
          },
        });

        return { ok: true, rsvpId: rsvp.id };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    const checkout = await db.rsvpCheckout.findUnique({
      where: { id: checkoutId },
      select: { rsvpId: true },
    });

    if (checkout?.rsvpId) {
      return { ok: true, rsvpId: checkout.rsvpId };
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
): Promise<RsvpCheckoutConfirmationResult> {
  const checkout = await db.rsvpCheckout.update({
    where: { id: checkoutId },
    data: {
      status: "PAYMENT_REVIEW",
      paymentReviewReason: reason,
      paymentCompletedAt: new Date(),
      lastReconciledAt: new Date(),
    },
    select: {
      rsvpId: true,
    },
  });

  if (checkout.rsvpId) {
    return { ok: true, rsvpId: checkout.rsvpId };
  }

  return { ok: false, reason: "review" };
}

async function finalizePaidCheckout(
  checkoutId: string,
  reviewReason: string,
): Promise<RsvpCheckoutConfirmationResult> {
  await db.rsvpCheckout.update({
    where: { id: checkoutId },
    data: {
      paymentCompletedAt: new Date(),
      lastReconciledAt: new Date(),
    },
  });

  const finalized = await finalizeRsvpCheckout(checkoutId);

  if (finalized.ok) {
    return finalized;
  }

  if (finalized.reason === "duplicate" || finalized.reason === "unavailable") {
    return markCheckoutPaymentReview(checkoutId, reviewReason);
  }

  return finalized;
}

async function ensureRsvpCheckoutPaymentLink(
  checkout: RsvpCheckoutRecord,
): Promise<RsvpCheckoutPaymentResult> {
  if (checkout.status === "CONFIRMED" && checkout.rsvpId) {
    return {
      ok: true,
      status: "confirmed",
      checkoutId: checkout.id,
      rsvpId: checkout.rsvpId,
      paymentUrl: null,
    };
  }

  if (checkout.status === "PAYMENT_REVIEW") {
    return { ok: false, reason: "review" };
  }

  const payload = parseCheckoutPayload(checkout.payload);

  if (await hasRsvpIdentityConflict(payload.email)) {
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
      logRsvpCheckoutEvent("error", "payment-resume-lookup-failed", {
        checkoutId: checkout.id,
        paymentReferenceFingerprint: getPaymentReferenceFingerprint(
          checkout.paymentReference,
        ),
        ...getErrorLogData(error),
      });

      return { ok: false, reason: "unavailable" };
    }

    if (!paymentLink) {
      logRsvpCheckoutEvent("warn", "payment-link-missing-recovery-started", {
        checkoutId: checkout.id,
        paymentReferenceFingerprint: getPaymentReferenceFingerprint(
          checkout.paymentReference,
        ),
      });
    }

    if (paymentLink?.isComplete) {
      logRsvpCheckoutEvent("info", "payment-link-reconcile-paid", {
        checkoutId: checkout.id,
        paymentReferenceFingerprint: getPaymentReferenceFingerprint(
          paymentLink.reference,
        ),
        orderState: paymentLink.orderState,
      });

      const finalized = await finalizePaidCheckout(
        checkout.id,
        "Square shows this RSVP checkout as paid, but local RSVP finalization did not complete.",
      );

      logRsvpCheckoutEvent(
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
          rsvpId: finalized.rsvpId,
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
      logRsvpCheckoutEvent("info", "payment-link-reused", {
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

      const data: Prisma.RsvpCheckoutUpdateInput = {};

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
        await db.rsvpCheckout.update({
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
    paymentLink = await createRsvpPaymentLink({
      checkoutId: checkout.id,
      email: payload.email,
      adultAttendeeCount: payload.adultAttendeeCount,
      childAttendeeCount: payload.childAttendeeCount,
    });
  } catch (error) {
    logRsvpCheckoutEvent("error", "payment-link-recovery-create-failed", {
      checkoutId: checkout.id,
      previousPaymentReferenceFingerprint: getPaymentReferenceFingerprint(
        checkout.paymentReference,
      ),
      ...getErrorLogData(error),
    });

    return { ok: false, reason: "unavailable" };
  }

  logRsvpCheckoutEvent("info", "payment-link-recovery-created", {
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
    logRsvpCheckoutEvent(
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

  return persistRecoveredRsvpPaymentLink({
    checkout,
    paymentLink: {
      reference: paymentLink.reference,
      orderId: paymentLink.orderId,
      url: paymentLink.url,
    },
  });
}

export async function createRsvpCheckoutPayment(payload: RsvpCheckoutPayload) {
  const parsedPayload = rsvpCheckoutPayloadSchema.parse(payload);

  if (await hasRsvpIdentityConflict(parsedPayload.email)) {
    return { ok: false, reason: "duplicate" } as const;
  }

  const checkout = await createOrReuseRsvpCheckout(parsedPayload);

  return ensureRsvpCheckoutPaymentLink(checkout);
}

export async function getRsvpCheckoutPayment(checkoutId: string) {
  const checkout = await db.rsvpCheckout.findUnique({
    where: { id: checkoutId },
  });

  if (!checkout) {
    return { ok: false, reason: "not_found" } as const;
  }

  return ensureRsvpCheckoutPaymentLink(checkout);
}

export async function confirmRsvpCheckoutPayment(
  checkoutId: string,
): Promise<RsvpCheckoutConfirmationResult> {
  const checkout = await db.rsvpCheckout.findUnique({
    where: { id: checkoutId },
  });

  if (!checkout) {
    return { ok: false, reason: "invalid" };
  }

  if (checkout.status === "CONFIRMED" && checkout.rsvpId) {
    return { ok: true, rsvpId: checkout.rsvpId };
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
    logRsvpCheckoutEvent("error", "payment-confirmation-lookup-failed", {
      checkoutId: checkout.id,
      paymentReferenceFingerprint: getPaymentReferenceFingerprint(
        checkout.paymentReference,
      ),
      ...getErrorLogData(error),
    });

    return {
      ok: false,
      reason: "pending",
      paymentUrl: checkout.paymentUrl,
    };
  }

  if (!paymentLink) {
    logRsvpCheckoutEvent("warn", "payment-confirmation-link-missing", {
      checkoutId: checkout.id,
      paymentReferenceFingerprint: getPaymentReferenceFingerprint(
        checkout.paymentReference,
      ),
    });

    return { ok: false, reason: "invalid" };
  }

  if (paymentLink.orderId && paymentLink.orderId !== checkout.paymentOrderId) {
    await db.rsvpCheckout.update({
      where: { id: checkout.id },
      data: {
        paymentOrderId: paymentLink.orderId,
        lastReconciledAt: new Date(),
      },
    });
  }

  if (!paymentLink.isComplete) {
    logRsvpCheckoutEvent("info", "payment-confirmation-still-open", {
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

  logRsvpCheckoutEvent("info", "payment-confirmation-paid", {
    checkoutId: checkout.id,
    paymentReferenceFingerprint: getPaymentReferenceFingerprint(
      paymentLink.reference,
    ),
    orderState: paymentLink.orderState,
  });

  const finalized = await finalizePaidCheckout(
    checkout.id,
    "Square return reconciliation showed this RSVP checkout as paid, but local RSVP finalization did not complete.",
  );

  logRsvpCheckoutEvent(
    finalized.ok ? "info" : "warn",
    "payment-confirmation-finalized",
    {
      checkoutId: checkout.id,
      outcome: finalized.ok ? "confirmed" : finalized.reason,
    },
  );

  return finalized;
}

export async function confirmRsvpCheckoutPaymentByOrderId(
  paymentOrderId: string,
): Promise<RsvpCheckoutConfirmationResult> {
  const orderId = paymentOrderId.trim();

  if (!orderId) {
    return { ok: false, reason: "invalid" };
  }

  const checkout = await db.rsvpCheckout.findUnique({
    where: { paymentOrderId: orderId },
  });

  if (!checkout) {
    return { ok: false, reason: "invalid" };
  }

  if (checkout.status === "CONFIRMED" && checkout.rsvpId) {
    return { ok: true, rsvpId: checkout.rsvpId };
  }

  if (checkout.status === "PAYMENT_REVIEW") {
    return { ok: false, reason: "review", paymentUrl: null };
  }

  return finalizePaidCheckout(
    checkout.id,
    "Square webhook showed this RSVP checkout as paid, but local RSVP finalization did not complete.",
  );
}
