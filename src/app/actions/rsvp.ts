"use server";

import { rsvpSchema, type SubmitRsvpResult } from "@/app/actions/type";
import { db } from "@/lib/db";
import { getRsvpCheckoutPaymentPath } from "@/lib/payment";
import {
  createRsvpCheckoutPayment,
  rsvpCheckoutPayloadSchema,
} from "@/lib/rsvpCheckout";

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
    phone: formData.get("phone"),
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
        reason:
          checkoutPayment.reason === "duplicate" ? "duplicate" : "unavailable",
        error:
          checkoutPayment.reason === "configuration"
            ? "Payment is not configured right now. Please try again later."
            : checkoutPayment.reason === "review"
              ? "This RSVP payment needs chair review before another checkout can be started. Contact the chair with your Square receipt if you already paid."
              : checkoutPayment.reason === "duplicate"
                ? duplicateRsvpMessage
                : checkoutPayment.reason === "unavailable"
                  ? "We could not reach Square to verify or reopen this checkout right now. Wait a moment and try again. If you already have a Square receipt, do not pay again; contact the chair."
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
