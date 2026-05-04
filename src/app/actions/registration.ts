"use server";

import {
  createRegistrationCheckoutPayment,
  registrationCheckoutPayloadSchema,
} from "@/lib/registrationCheckout";
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

const registrationSubmitSchema = z
  .object({
    firstName: requiredTextSchema,
    lastName: requiredTextSchema,
    email: z
      .string()
      .trim()
      .email()
      .transform((value) => value.toLowerCase()),
    phone: requiredTextSchema,
    gender: z.enum(["MALE", "FEMALE", "NON_BINARY", "PREFER_NOT_TO_SAY"]),
    age: requiredIntSchema(1, 110),
    averageScore: requiredIntSchema(20, 120),
    packageSelection: requiredTextSchema,
    adultGuestCount: requiredIntSchema(0, 20),
    childGuestCount: requiredIntSchema(0, 20),
    dayBeforeRsvp: z
      .preprocess(normalizeRequiredFormValue, z.enum(["yes", "no"]))
      .transform((value) => value === "yes"),
    notes: requiredTextSchema,
  })
  .refine((data) => data.adultGuestCount + data.childGuestCount <= 20, {
    message: "Keep total pre-event guests at 20 or fewer.",
    path: ["adultGuestCount"],
  });

function getRegistrationPaymentErrorMessage(error: unknown) {
  return error instanceof Error && process.env.NODE_ENV !== "production"
    ? `Registration payment could not be started. ${error.message}`
    : "Registration payment could not be started. Please try again.";
}

const duplicateRegistrationMessage =
  "This email already has a registration or RSVP on file.";

export type SubmitRegistrationResult =
  | {
      ok: true;
      checkoutId: string;
      checkoutUrl: string;
      paymentUrl: string;
      paymentPath: string;
      thanksPath: string;
      registrationId?: string;
      alreadyConfirmed?: boolean;
    }
  | {
      ok: false;
      error: string;
    };

export async function submitRegistration(
  formData: FormData,
): Promise<SubmitRegistrationResult> {
  const parsed = registrationSubmitSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    gender: formData.get("gender"),
    age: formData.get("age"),
    averageScore: formData.get("averageScore"),
    packageSelection: formData.get("packageSelection"),
    adultGuestCount: formData.get("adultGuestCount"),
    childGuestCount: formData.get("childGuestCount"),
    dayBeforeRsvp: formData.get("dayBeforeRsvp"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Complete the required registration details and try again.",
    };
  }

  try {
    const checkoutPayment = await createRegistrationCheckoutPayment(
      registrationCheckoutPayloadSchema.parse(parsed.data),
    );

    if (!checkoutPayment.ok) {
      return {
        ok: false,
        error:
          checkoutPayment.reason === "duplicate"
            ? duplicateRegistrationMessage
            : checkoutPayment.reason === "configuration"
              ? "Payment is not configured right now. Please try again later."
              : checkoutPayment.reason === "review"
                ? "This payment needs chair review before another checkout can be started. Contact the chair with your Square receipt if you already paid."
                : "Payment could not be started right now. Please try again.",
      };
    }

    if (checkoutPayment.status === "confirmed") {
      const thanksPath = `/register/thanks?registration=${encodeURIComponent(checkoutPayment.registrationId)}&payment=confirmed`;

      return {
        ok: true,
        checkoutId: checkoutPayment.checkoutId,
        checkoutUrl: thanksPath,
        paymentUrl: thanksPath,
        paymentPath: thanksPath,
        thanksPath,
        registrationId: checkoutPayment.registrationId,
        alreadyConfirmed: true,
      };
    }

    const paymentPath = `/register/payment?checkout=${encodeURIComponent(checkoutPayment.checkoutId)}`;
    const thanksPath = `/register/thanks?checkout=${encodeURIComponent(checkoutPayment.checkoutId)}`;

    return {
      ok: true,
      checkoutId: checkoutPayment.checkoutId,
      checkoutUrl: checkoutPayment.paymentUrl,
      paymentUrl: checkoutPayment.paymentUrl,
      paymentPath,
      thanksPath,
    };
  } catch (error) {
    console.error("Registration payment start failed", error);

    return {
      ok: false,
      error: getRegistrationPaymentErrorMessage(error),
    };
  }
}
