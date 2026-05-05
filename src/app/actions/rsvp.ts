"use server";

import { db } from "@/lib/db";
import { getRsvpCheckoutPaymentPath } from "@/lib/payment";
import {
  createRsvpCheckoutPayment,
  rsvpCheckoutPayloadSchema,
} from "@/lib/rsvpCheckout";
import { Prisma } from "@prisma/client";
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
    attending: z.preprocess(normalizeRequiredFormValue, z.enum(["yes", "no"])),
    adultAttendeeCount: requiredIntSchema(0, 30),
    childAttendeeCount: requiredIntSchema(0, 30),
    familyNames: optionalTextSchema,
    dietaryNotes: optionalTextSchema,
    notes: optionalTextSchema,
  })
  .refine((data) => data.adultAttendeeCount + data.childAttendeeCount <= 30, {
    message: "Keep the party size at 30 attendees or fewer.",
    path: ["adultAttendeeCount"],
  })
  .superRefine((data, context) => {
    const attendeeCount = data.adultAttendeeCount + data.childAttendeeCount;

    if (data.attending === "yes" && attendeeCount === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Add at least one attendee when attending.",
        path: ["adultAttendeeCount"],
      });
    }

    if (data.attending === "yes") {
      for (const field of ["familyNames", "dietaryNotes", "notes"] as const) {
        if (!data[field]) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Complete the BBQ RSVP details.",
            path: [field],
          });
        }
      }
    }

    if (data.attending === "no" && attendeeCount !== 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Set attendee counts to zero when not attending.",
        path: ["adultAttendeeCount"],
      });
    }
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
const activeRsvpCheckoutMessage =
  "This email already has a pending RSVP checkout. Resume checkout or contact the chair before sending another RSVP.";

function getRsvpPaymentErrorMessage(error: unknown) {
  return error instanceof Error && process.env.NODE_ENV !== "production"
    ? `RSVP payment could not be started. ${error.message}`
    : "RSVP payment could not be started. Please try again.";
}

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export async function submitRsvp(
  formData: FormData,
): Promise<SubmitRsvpResult> {
  const parsed = rsvpSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    attending: formData.get("attending"),
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

  if (parsed.data.attending === "yes") {
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

      const paymentPath = getRsvpCheckoutPaymentPath(
        checkoutPayment.checkoutId,
      );
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

  const activeRsvpCheckout = await db.rsvpCheckout.findFirst({
    where: {
      email,
      status: { in: ["PENDING", "PAYMENT_REVIEW"] },
    },
    select: { id: true },
  });

  if (activeRsvpCheckout) {
    return {
      ok: false,
      reason: "duplicate",
      error: activeRsvpCheckoutMessage,
    };
  }

  const participant = await db.participant.findUnique({ where: { email } });
  const participantId = participant?.id ?? null;
  const attendeeCount =
    parsed.data.adultAttendeeCount + parsed.data.childAttendeeCount;

  try {
    await db.rsvp.create({
      data: {
        participantId,
        source: "FORM",
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        email,
        attending: false,
        adultAttendeeCount: parsed.data.adultAttendeeCount,
        childAttendeeCount: parsed.data.childAttendeeCount,
        attendeeCount,
        familyNames: parsed.data.familyNames,
        dietaryNotes: parsed.data.dietaryNotes,
        notes: parsed.data.notes,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return {
        ok: false,
        reason: "duplicate",
        error: duplicateRsvpMessage,
      };
    }

    throw error;
  }

  return {
    ok: true,
    thanksPath: "/rsvp/thanks",
  };
}
