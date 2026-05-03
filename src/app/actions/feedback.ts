"use server";

import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { z } from "zod";

const feedbackSchema = z.object({
  name: z.string().trim().optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  category: z.string().trim().min(1),
  message: z.string().trim().min(3),
});

function optionalText(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length ? text : undefined;
}

export async function submitFeedback(formData: FormData) {
  const parsed = feedbackSchema.parse({
    name: optionalText(formData.get("name")),
    email: optionalText(formData.get("email")) ?? "",
    rating: optionalText(formData.get("rating")),
    category: formData.get("category"),
    message: formData.get("message"),
  });

  await db.feedback.create({
    data: {
      name: parsed.name,
      email: parsed.email || undefined,
      rating: parsed.rating,
      category: parsed.category,
      message: parsed.message,
    },
  });

  redirect("/feedback/thanks");
}
