import { db } from "@/lib/db";
import {
  createRsvpPaymentLink,
  getRegistrationPaymentLinkState,
  hasSquarePaymentConfiguration,
} from "@/lib/payment";
import { Prisma } from "@prisma/client";
import { createHash, randomUUID } from "crypto";
import { z } from "zod";

const requiredTextSchema = z
  .preprocess(
    (value) => (typeof value === "string" ? value.trim() : value),
    z.string().trim().min(1),
  )
  .transform((value) => value.trim());

const optionalTextSchema = z
  .preprocess(
    (value) => (typeof value === "string" ? value.trim() : value),
    z.string().optional().nullable(),
  )
  .transform((value) => (value && value.length > 0 ? value : null));

export const rsvpCheckoutPayloadSchema = z
  .object({
    firstName: requiredTextSchema,
    lastName: requiredTextSchema,
    email: z
      .string()
      .trim()
      .email()
      .transform((value) => value.toLowerCase()),
    adultAttendeeCount: z.coerce.number().int().min(0).max(30),
    childAttendeeCount: z.coerce.number().int().min(0).max(30),
    familyNames: optionalTextSchema,
    dietaryNotes: optionalTextSchema,
    notes: optionalTextSchema,
  })
  .refine((data) => data.adultAttendeeCount + data.childAttendeeCount <= 30, {
    message: "Keep the party size at 30 attendees or fewer.",
    path: ["adultAttendeeCount"],
  })
  .refine((data) => data.adultAttendeeCount + data.childAttendeeCount > 0, {
    message: "Add at least one attendee to RSVP.",
    path: ["adultAttendeeCount"],
  });

export type RsvpCheckoutPayload = z.infer<typeof rsvpCheckoutPayloadSchema>;

type RsvpCheckoutRecord = {
  id: string;
  idempotencyKey: string;
  email: string;
  payload: unknown;
  paymentReference: string | null;
  paymentOrderId: string | null;
  paymentUrl: string | null;
  status: string;
  rsvpId: string | null;
  confirmedAt: Date | null;
  paymentCompletedAt: Date | null;
  paymentReviewReason: string | null;
  lastReconciledAt: Date | null;
};

export type RsvpCheckoutPaymentResult =
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
      rsvpId: string;
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

export type RsvpCheckoutConfirmationResult =
  | {
      ok: true;
      rsvpId: string;
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
            attending: true,
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
      console.error("RSVP checkout payment resume lookup failed", {
        checkoutId: checkout.id,
        error,
      });

      return { ok: false, reason: "unavailable" };
    }

    const reusablePaymentUrl = paymentLink?.url ?? checkout.paymentUrl;

    if (reusablePaymentUrl) {
      const data: Prisma.RsvpCheckoutUpdateInput = {};

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
          "Square shows this RSVP checkout as paid, but local RSVP finalization did not complete.",
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
        paymentReference: checkout.paymentReference,
        paymentUrl: reusablePaymentUrl,
      };
    }
  }

  const paymentLink = await createRsvpPaymentLink({
    checkoutId: checkout.id,
    email: payload.email,
    adultAttendeeCount: payload.adultAttendeeCount,
    childAttendeeCount: payload.childAttendeeCount,
  });

  if (!paymentLink.reference) {
    return { ok: false, reason: "unavailable" };
  }

  const data: Prisma.RsvpCheckoutUpdateInput = {
    paymentReference: paymentLink.reference,
    paymentUrl: paymentLink.url,
  };

  if (paymentLink.orderId) {
    data.paymentOrderId = paymentLink.orderId;
  }

  await db.rsvpCheckout.update({
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
    console.error("RSVP checkout payment lookup failed", {
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
    await db.rsvpCheckout.update({
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
    "Square return reconciliation showed this RSVP checkout as paid, but local RSVP finalization did not complete.",
  );
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
