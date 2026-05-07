import { db } from "@/lib/db";
import {
  createRegistrationPaymentLink,
  getRegistrationPaymentLinkState,
  hasSquarePaymentConfiguration,
} from "@/lib/payment";
import { Prisma } from "@prisma/client";
import { createHash, randomUUID } from "crypto";
import { z } from "zod";

function normalizeRequiredFormValue(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();

    return trimmed.length > 0 ? trimmed : undefined;
  }

  return value ?? undefined;
}

const requiredTextSchema = z.preprocess(
  normalizeRequiredFormValue,
  z.string().trim().min(1),
);

const optionalTextSchema = z
  .preprocess(
    (value) => (typeof value === "string" ? value.trim() : value),
    z.string().optional().nullable(),
  )
  .transform((value) => (value && value.length > 0 ? value : null));

const golferSchema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  gender: z.enum(["MALE", "FEMALE"]),
  age: z.coerce.number().int().min(1).max(110),
  averageScore: z.coerce.number().int().min(20).max(120),
});

export const registrationCheckoutPayloadSchema = z
  .object({
    firstName: z.string().trim().min(1),
    lastName: z.string().trim().min(1),
    email: z
      .string()
      .trim()
      .email()
      .transform((value) => value.toLowerCase()),
    phone: requiredTextSchema,
    packageSelection: z.string().trim().min(1),
    golfers: z.array(golferSchema).min(1).max(20),
    bbqOnlyAdultCount: z.coerce.number().int().min(0).max(30),
    bbqOnlyKidCount: z.coerce.number().int().min(0).max(30),
    notes: optionalTextSchema,
    dietaryNotes: optionalTextSchema,
  })
  .refine((data) => data.bbqOnlyAdultCount + data.bbqOnlyKidCount <= 30, {
    message: "Keep additional BBQ-only guests at 30 or fewer.",
    path: ["bbqOnlyAdultCount"],
  });

export type RegistrationCheckoutPayload = z.infer<
  typeof registrationCheckoutPayloadSchema
>;

type RegistrationCheckoutRecord = {
  id: string;
  idempotencyKey: string;
  email: string;
  payload: unknown;
  paymentReference: string | null;
  paymentOrderId: string | null;
  paymentUrl: string | null;
  status: string;
  registrationId: string | null;
  confirmedAt: Date | null;
  paymentCompletedAt: Date | null;
  paymentReviewReason: string | null;
  lastReconciledAt: Date | null;
};

export type RegistrationCheckoutPaymentResult =
  | {
      ok: true;
      status: "pending";
      checkoutId: string;
      paymentReference: string;
      paymentUrl: string;
    }
  | {
      ok: true;
      status: "confirmed";
      checkoutId: string;
      registrationId: string;
      paymentUrl: null;
    }
  | {
      ok: false;
      reason:
        | "configuration"
        | "duplicate"
        | "not_found"
        | "review"
        | "unavailable";
    };

export type RegistrationCheckoutConfirmationResult =
  | {
      ok: true;
      registrationId: string;
    }
  | {
      ok: false;
      reason: "duplicate" | "invalid" | "pending" | "review" | "unavailable";
      paymentUrl?: string | null;
    };

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
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
              email: null,
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
      console.error("Registration checkout payment resume lookup failed", {
        checkoutId: checkout.id,
        error,
      });

      return { ok: false, reason: "unavailable" };
    }

    const reusablePaymentUrl = paymentLink?.url ?? checkout.paymentUrl;

    if (reusablePaymentUrl) {
      const data: Prisma.RegistrationCheckoutUpdateInput = {};

      if (paymentLink?.url && paymentLink.url !== checkout.paymentUrl) {
        data.paymentUrl = paymentLink.url;
      }

      if (paymentLink?.orderId) {
        data.paymentOrderId = paymentLink.orderId;
      }

      if (paymentLink) {
        data.lastReconciledAt = new Date();
      }

      if (paymentLink?.isComplete) {
        const finalized = await finalizePaidCheckout(
          checkout.id,
          "Square shows this checkout as paid, but local registration finalization did not complete.",
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
        paymentReference: checkout.paymentReference,
        paymentUrl: reusablePaymentUrl,
      };
    }
  }

  const paymentLink = await createRegistrationPaymentLink({
    checkoutId: checkout.id,
    email: payload.email,
    golferCount: payload.golfers.length,
    bbqOnlyAdultCount: payload.bbqOnlyAdultCount,
    bbqOnlyKidCount: payload.bbqOnlyKidCount,
  });

  if (!paymentLink.reference) {
    return { ok: false, reason: "unavailable" };
  }

  const data: Prisma.RegistrationCheckoutUpdateInput = {
    paymentReference: paymentLink.reference,
    paymentUrl: paymentLink.url,
  };

  if (paymentLink.orderId) {
    data.paymentOrderId = paymentLink.orderId;
  }

  await db.registrationCheckout.update({
    where: { id: checkout.id },
    data,
  });

  return {
    ok: true,
    status: "pending",
    checkoutId: checkout.id,
    paymentReference: paymentLink.reference,
    paymentUrl: paymentLink.url,
  };
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
    console.error("Registration checkout payment lookup failed", {
      checkoutId: checkout.id,
      error,
    });

    return {
      ok: false,
      reason: "pending",
      paymentUrl: checkout.paymentUrl,
    };
  }

  if (!paymentLink) {
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
    return {
      ok: false,
      reason: "pending",
      paymentUrl: paymentLink.url ?? checkout.paymentUrl,
    };
  }

  return finalizePaidCheckout(
    checkout.id,
    "Square return reconciliation showed this checkout as paid, but local registration finalization did not complete.",
  );
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
