"use server";

import type { ActionResult } from "@/components/notices/type";
import { db } from "@/lib/db";
import { feedbackSubmissionSchema } from "@/lib/formContracts";

export async function submitFeedback(
  formData: FormData,
): Promise<ActionResult> {
  try {
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

    return { redirectTo: "/feedback/thanks" };
  } catch (error) {
    // Trust boundary: log server-side only, return a static notice code.
    console.error("feedback submission failed", error);
    return { redirectTo: "/feedback?feedback=submit-failed" };
  }
}
