"use server";

import { db } from "@/lib/db";
import { getRsvpCheckoutPaymentPath } from "@/lib/payment";
import {
  createRsvpCheckoutPayment,
  rsvpCheckoutPayloadSchema,
} from "@/lib/rsvpCheckout";
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

const requiredIntSchema = (minimum: number, maximum: number) =>
  z.preprocess(
    normalizeRequiredFormValue,
    z.coerce.number().int().min(minimum).max(maximum),
  );

const rsvpSchema = z
  .object({
    firstName: requiredTextSchema,
    lastName: requiredTextSchema,
    email: z
      .string()
      .trim()
      .email()
      .transform((value) => value.toLowerCase()),
    adultAttendeeCount: requiredIntSchema(0, 30),
    childAttendeeCount: requiredIntSchema(0, 30),
    familyNames: requiredTextSchema,
    dietaryNotes: requiredTextSchema,
    notes: requiredTextSchema,
  })
  .refine((data) => data.adultAttendeeCount + data.childAttendeeCount <= 30, {
    message: "Keep the party size at 30 attendees or fewer.",
    path: ["adultAttendeeCount"],
  })
  .refine((data) => data.adultAttendeeCount + data.childAttendeeCount > 0, {
    message: "Add at least one BBQ attendee.",
    path: ["adultAttendeeCount"],
  });

export type SubmitRsvpResult =
  | {
      ok: true;
      requiresPayment?: false;
      thanksPath: string;
      rsvpId?: string;
    }
  | {
      ok: true;
      requiresPayment: true;
      checkoutId: string;
      checkoutUrl: string;
      paymentUrl: string;
      paymentPath: string;
      thanksPath: string;
      rsvpId?: string;
      alreadyConfirmed?: boolean;
    }
  | {
      ok: false;
      reason: "invalid" | "duplicate";
      error: string;
    };

const duplicateRsvpMessage =
  "This email already has a registration or RSVP on file.";
const activeCheckoutMessage =
  "This email already has a pending golf registration checkout. Resume checkout or contact the chair before sending an RSVP.";

function getRsvpPaymentErrorMessage(error: unknown) {
  return error instanceof Error && process.env.NODE_ENV !== "production"
    ? `RSVP payment could not be started. ${error.message}`
    : "RSVP payment could not be started. Please try again.";
}

export async function submitRsvp(
  formData: FormData,
): Promise<SubmitRsvpResult> {
  const parsed = rsvpSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    adultAttendeeCount: formData.get("adultAttendeeCount"),
    childAttendeeCount: formData.get("childAttendeeCount"),
    familyNames: formData.get("familyNames"),
    dietaryNotes: formData.get("dietaryNotes"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      reason: "invalid",
      error: "Complete the required RSVP details and try again.",
    };
  }

  const email = parsed.data.email;

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
    return {
      ok: false,
      reason: "duplicate",
      error: duplicateRsvpMessage,
    };
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
    return {
      ok: false,
      reason: "duplicate",
      error: duplicateRsvpMessage,
    };
  }

  const existingRsvp = await db.rsvp.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingRsvp) {
    return {
      ok: false,
      reason: "duplicate",
      error: duplicateRsvpMessage,
    };
  }

  const activeRegistrationCheckout = await db.registrationCheckout.findFirst({
    where: {
      email,
      status: { in: ["PENDING", "PAYMENT_REVIEW"] },
    },
    select: { id: true },
  });

  if (activeRegistrationCheckout) {
    return {
      ok: false,
      reason: "duplicate",
      error: activeCheckoutMessage,
    };
  }

  try {
    const checkoutPayment = await createRsvpCheckoutPayment(
      rsvpCheckoutPayloadSchema.parse({
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        email,
        adultAttendeeCount: parsed.data.adultAttendeeCount,
        childAttendeeCount: parsed.data.childAttendeeCount,
        familyNames: parsed.data.familyNames,
        dietaryNotes: parsed.data.dietaryNotes,
        notes: parsed.data.notes,
      }),
    );

    if (!checkoutPayment.ok) {
      return {
        ok: false,
        reason: "duplicate",
        error:
          checkoutPayment.reason === "configuration"
            ? "Payment is not configured right now. Please try again later."
            : checkoutPayment.reason === "review"
              ? "This RSVP payment needs chair review before another checkout can be started. Contact the chair with your Square receipt if you already paid."
              : checkoutPayment.reason === "duplicate"
                ? duplicateRsvpMessage
                : "Payment could not be started right now. Please try again.",
      };
    }

    if (checkoutPayment.status === "confirmed") {
      const thanksPath = `/rsvp/thanks?rsvp=${encodeURIComponent(checkoutPayment.rsvpId)}&payment=confirmed`;

      return {
        ok: true,
        requiresPayment: true,
        checkoutId: checkoutPayment.checkoutId,
        checkoutUrl: thanksPath,
        paymentUrl: thanksPath,
        paymentPath: thanksPath,
        thanksPath,
        rsvpId: checkoutPayment.rsvpId,
        alreadyConfirmed: true,
      };
    }

    const paymentPath = getRsvpCheckoutPaymentPath(checkoutPayment.checkoutId);
    const thanksPath = `/rsvp/thanks?rsvpCheckout=${encodeURIComponent(checkoutPayment.checkoutId)}`;

    return {
      ok: true,
      requiresPayment: true,
      checkoutId: checkoutPayment.checkoutId,
      checkoutUrl: checkoutPayment.paymentUrl,
      paymentUrl: checkoutPayment.paymentUrl,
      paymentPath,
      thanksPath,
    };
  } catch (error) {
    console.error("RSVP payment start failed", error);

    return {
      ok: false,
      reason: "invalid",
      error: getRsvpPaymentErrorMessage(error),
    };
  }
}
