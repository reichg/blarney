"use server";

import { db } from "@/lib/db";
import { redirect } from "next/navigation";
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

const feedbackSchema = z.object({
  name: requiredTextSchema,
  email: z.preprocess(normalizeRequiredFormValue, z.string().trim().email()),
  rating: requiredIntSchema(1, 5),
  category: requiredTextSchema,
  message: z.preprocess(normalizeRequiredFormValue, z.string().trim().min(3)),
});

export async function submitFeedback(formData: FormData) {
  const parsed = feedbackSchema.parse({
    name: formData.get("name"),
    email: formData.get("email"),
    rating: formData.get("rating"),
    category: formData.get("category"),
    message: formData.get("message"),
  });

  await db.feedback.create({
    data: {
      name: parsed.name,
      email: parsed.email,
      rating: parsed.rating,
      category: parsed.category,
      message: parsed.message,
    },
  });

  redirect("/feedback/thanks");
}
