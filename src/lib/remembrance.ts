import { z } from "zod";

function normalizeOptionalString(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();

    return trimmed.length ? trimmed : undefined;
  }

  return value ?? undefined;
}

export const REMEMBRANCE_FEEDBACK_CATEGORY = "In Remembrance";

export const remembranceSubmissionSchema = z.object({
  message: z.preprocess(
    normalizeOptionalString,
    z.string().trim().min(1, "Remembrance text is required."),
  ),
  name: z.preprocess(
    normalizeOptionalString,
    z.string().trim().min(1).optional(),
  ),
  email: z.preprocess(
    normalizeOptionalString,
    z.string().trim().email().optional(),
  ),
});
