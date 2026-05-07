"use server";

import { db } from "@/lib/db";
import { feedbackSubmissionSchema } from "@/lib/formContracts";
import { redirect } from "next/navigation";

export async function submitFeedback(formData: FormData) {
  const feedback = feedbackSubmissionSchema.parse({
    name: formData.get("name"),
    email: formData.get("email"),
    rating: formData.get("rating"),
    category: formData.get("category"),
    message: formData.get("message"),
  });

  await db.feedback.create({
    data: {
      name: feedback.name,
      email: feedback.email,
      rating: feedback.rating,
      category: feedback.category,
      message: feedback.message,
    },
  });

  redirect("/feedback/thanks");
}
