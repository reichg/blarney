"use server";

import {
  registrationSubmitSchema,
  type SubmitRegistrationResult,
} from "@/app/actions/type";
import {
  createRegistrationCheckoutPayment,
  registrationCheckoutPayloadSchema,
} from "@/lib/registrationCheckout";

function getFirstFormValue(formData: FormData, names: string[]) {
  for (const name of names) {
    const value = formData.get(name);

    if (value !== null) {
      return value;
    }
  }

  return null;
}

function getFormValues(formData: FormData, names: string[]) {
  for (const name of names) {
    const values = formData.getAll(name);

    if (values.length > 0) {
      return values;
    }
  }

  return [];
}

function parseGolfersFromFormData(formData: FormData) {
  const rawGolfers = formData.get("golfers");

  if (typeof rawGolfers === "string" && rawGolfers.trim().length > 0) {
    try {
      return JSON.parse(rawGolfers) as unknown;
    } catch {
      return rawGolfers;
    }
  }

  const firstNames = getFormValues(formData, [
    "golferFirstName",
    "golferFirstName[]",
    "golfers.firstName",
  ]);
  const lastNames = getFormValues(formData, [
    "golferLastName",
    "golferLastName[]",
    "golfers.lastName",
  ]);
  const genders = getFormValues(formData, [
    "golferGender",
    "golferGender[]",
    "golfers.gender",
  ]);
  const ages = getFormValues(formData, [
    "golferAge",
    "golferAge[]",
    "golfers.age",
  ]);
  const averageScores = getFormValues(formData, [
    "golferAverageScore",
    "golferAverageScore[]",
    "golfers.averageScore",
  ]);

  if (firstNames.length > 0) {
    return firstNames.map((firstName, index) => ({
      firstName,
      lastName: lastNames[index],
      gender: genders[index],
      age: ages[index],
      averageScore: averageScores[index],
    }));
  }

  return [
    {
      firstName: getFirstFormValue(formData, ["golferFirstName", "firstName"]),
      lastName: getFirstFormValue(formData, ["golferLastName", "lastName"]),
      gender: formData.get("gender"),
      age: formData.get("age"),
      averageScore: formData.get("averageScore"),
    },
  ];
}

function getRegistrationPaymentErrorMessage(error: unknown) {
  return error instanceof Error && process.env.NODE_ENV !== "production"
    ? `Registration payment could not be started. ${error.message}`
    : "Registration payment could not be started. Please try again.";
}

const duplicateRegistrationMessage =
  "This email already has a registration or RSVP on file.";

export async function submitRegistration(
  formData: FormData,
): Promise<SubmitRegistrationResult> {
  const parsed = registrationSubmitSchema.safeParse({
    firstName: getFirstFormValue(formData, ["firstName", "contactFirstName"]),
    lastName: getFirstFormValue(formData, ["lastName", "contactLastName"]),
    email: getFirstFormValue(formData, ["email", "contactEmail"]),
    phone: formData.get("phone"),
    packageSelection: formData.get("packageSelection"),
    golfers: parseGolfersFromFormData(formData),
    bbqOnlyAdultCount: getFirstFormValue(formData, [
      "bbqOnlyAdultCount",
      "adultGuestCount",
    ]),
    bbqOnlyKidCount: getFirstFormValue(formData, [
      "bbqOnlyKidCount",
      "childGuestCount",
    ]),
    notes: formData.get("notes"),
    dietaryNotes: formData.get("dietaryNotes"),
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
                : checkoutPayment.reason === "unavailable"
                  ? "We could not reach Square to verify or reopen this checkout right now. Wait a moment and try again. If you already have a Square receipt, do not pay again; contact the chair."
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
