import { z } from "zod";

function normalizeOptionalString(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();

    return trimmed.length ? trimmed : undefined;
  }

  return value ?? undefined;
}

export const presignSchema = z
  .object({
    fileName: z.string().trim().min(1),
    contentType: z.string().trim().min(1),
    fileSize: z.number().int().positive(),
    submitterName: z.string().trim().min(1),
    submitterEmail: z.string().trim().email(),
    caption: z.preprocess(
      normalizeOptionalString,
      z.string().trim().min(1).optional(),
    ),
    purpose: z.enum(["GALLERY", "REMEMBRANCE"]).default("GALLERY"),
    feedbackId: z.preprocess(
      normalizeOptionalString,
      z.string().trim().min(1).optional(),
    ),
  })
  .superRefine((value, context) => {
    if (value.purpose === "REMEMBRANCE" && !value.feedbackId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Remembrance uploads require a feedbackId.",
        path: ["feedbackId"],
      });
    }

    if (value.purpose === "GALLERY" && value.feedbackId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Gallery uploads cannot include a feedbackId.",
        path: ["feedbackId"],
      });
    }
  });
