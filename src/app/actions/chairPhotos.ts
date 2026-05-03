"use server";

import { db } from "@/lib/db";
import { copyPendingPhotoToApproved } from "@/lib/s3";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const photoReviewSchema = z.object({
  id: z.string().min(1),
  reviewNotes: z.string().trim().optional(),
});

function optionalText(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length ? text : undefined;
}

export async function approvePhoto(formData: FormData) {
  const parsed = photoReviewSchema.parse({
    id: formData.get("id"),
    reviewNotes: optionalText(formData.get("reviewNotes")),
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
    reviewNotes: optionalText(formData.get("reviewNotes")),
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
