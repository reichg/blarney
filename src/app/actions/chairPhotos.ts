"use server";

import { db } from "@/lib/db";
import { copyPendingPhotoToApproved } from "@/lib/s3";
import { revalidatePath } from "next/cache";
import { z } from "zod";

function normalizeRequiredFormValue(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();

    return trimmed.length ? trimmed : undefined;
  }

  return value ?? undefined;
}

const photoReviewSchema = z.object({
  id: z.string().min(1),
  reviewNotes: z.preprocess(
    normalizeRequiredFormValue,
    z.string().trim().min(1),
  ),
});

export async function approvePhoto(formData: FormData) {
  const parsed = photoReviewSchema.parse({
    id: formData.get("id"),
    reviewNotes: formData.get("reviewNotes"),
  });

  const photo = await db.photoSubmission.findUniqueOrThrow({
    where: { id: parsed.id },
  });
  const approvedS3Key = await copyPendingPhotoToApproved(photo.s3Key);

  await db.photoSubmission.update({
    where: { id: parsed.id },
    data: {
      approvedAt: new Date(),
      approvedS3Key,
      reviewNotes: parsed.reviewNotes,
      status: "APPROVED",
    },
  });

  revalidatePath("/photos");
  revalidatePath("/chair/photos");
}

export async function rejectPhoto(formData: FormData) {
  const parsed = photoReviewSchema.parse({
    id: formData.get("id"),
    reviewNotes: formData.get("reviewNotes"),
  });

  await db.photoSubmission.update({
    where: { id: parsed.id },
    data: {
      reviewNotes: parsed.reviewNotes,
      status: "REJECTED",
    },
  });

  revalidatePath("/chair/photos");
}
