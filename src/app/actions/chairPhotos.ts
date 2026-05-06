"use server";

import { CHAIR_COOKIE, verifyChairToken } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  approvedKeyFromPendingKey,
  deletePhotoObject,
  moveApprovedPhotoToPending,
  movePendingPhotoToApproved,
} from "@/lib/s3";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

function normalizeRequiredFormValue(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();

    return trimmed.length ? trimmed : undefined;
  }

  return value ?? undefined;
}

const photoReviewSchema = z.object({
  id: z.preprocess(normalizeRequiredFormValue, z.string().trim().min(1)),
  reviewNotes: z.preprocess(
    normalizeRequiredFormValue,
    z.string().trim().min(1).optional(),
  ),
});

const photoIdSchema = z.object({
  id: z.preprocess(normalizeRequiredFormValue, z.string().trim().min(1)),
});

async function requireChairSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(CHAIR_COOKIE)?.value;
  const isAuthorized = await verifyChairToken(token);

  if (!isAuthorized) {
    redirect("/chair/login");
  }
}

async function deletePendingPhotoById(id: string, errorMessage: string) {
  const photo = await db.photoSubmission.findUniqueOrThrow({
    where: { id },
  });

  if (photo.status !== "PENDING") {
    throw new Error(errorMessage);
  }

  await deletePhotoObject(photo.s3Key);
  await db.photoSubmission.delete({
    where: { id },
  });
}

export async function approvePhoto(formData: FormData) {
  await requireChairSession();

  const parsed = photoReviewSchema.parse({
    id: formData.get("id"),
    reviewNotes: formData.get("reviewNotes"),
  });

  const photo = await db.photoSubmission.findUniqueOrThrow({
    where: { id: parsed.id },
  });

  if (photo.status !== "PENDING") {
    throw new Error("Only pending photos can be approved.");
  }

  const approvedS3Key = await movePendingPhotoToApproved(photo.s3Key);

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
  revalidatePath("/chair/remembrance");
}

export async function rejectPhoto(formData: FormData) {
  await requireChairSession();

  const parsed = photoIdSchema.parse({
    id: formData.get("id"),
  });

  await deletePendingPhotoById(
    parsed.id,
    "Only pending photos can be rejected.",
  );

  revalidatePath("/chair/photos");
  revalidatePath("/chair/remembrance");
}

export async function returnApprovedPhotoToPending(formData: FormData) {
  await requireChairSession();

  const parsed = photoReviewSchema.parse({
    id: formData.get("id"),
    reviewNotes: formData.get("reviewNotes"),
  });

  const photo = await db.photoSubmission.findUniqueOrThrow({
    where: { id: parsed.id },
  });

  if (photo.status !== "APPROVED") {
    throw new Error("Only approved photos can be returned to pending.");
  }

  await moveApprovedPhotoToPending(
    photo.approvedS3Key ?? approvedKeyFromPendingKey(photo.s3Key),
    photo.s3Key,
  );

  await db.photoSubmission.update({
    where: { id: parsed.id },
    data: {
      approvedAt: null,
      approvedS3Key: null,
      reviewNotes: parsed.reviewNotes,
      status: "PENDING",
    },
  });

  revalidatePath("/photos");
  revalidatePath("/chair/photos");
  revalidatePath("/chair/remembrance");
}

export async function deletePendingPhoto(formData: FormData) {
  await requireChairSession();

  const parsed = photoIdSchema.parse({
    id: formData.get("id"),
  });

  await deletePendingPhotoById(
    parsed.id,
    "Only pending photos can be deleted.",
  );

  revalidatePath("/chair/photos");
  revalidatePath("/chair/remembrance");
}
