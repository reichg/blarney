import { z } from "zod";

function normalizeRequiredFormValue(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();

    return trimmed.length ? trimmed : undefined;
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

export const registrationPackageOptions = ["Golf registration"] as const;

export type RegistrationPackageSelection =
  (typeof registrationPackageOptions)[number];

export const defaultRegistrationPackageSelection =
  registrationPackageOptions[0];

export const feedbackCategoryOptions = [
  "Registration",
  "Logistics",
  "Pairings",
  "Photos",
  "Other",
] as const;

export type FeedbackCategory = (typeof feedbackCategoryOptions)[number];

export const feedbackRatingOptions = [5, 4, 3, 2, 1] as const;

export const feedbackSubmissionSchema = z.object({
  name: requiredTextSchema,
  email: z.preprocess(normalizeRequiredFormValue, z.string().trim().email()),
  rating: requiredIntSchema(1, 5),
  category: z.preprocess(
    normalizeRequiredFormValue,
    z.enum(feedbackCategoryOptions),
  ),
  message: z.preprocess(normalizeRequiredFormValue, z.string().trim().min(3)),
});
