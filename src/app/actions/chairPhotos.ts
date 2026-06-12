"use server";

import { photoIdSchema, photoReviewSchema } from "@/app/actions/type";
import type { ChairActionResult } from "@/app/chair/notices/type";
import {
  PHOTOS_NOTICE_PARAM,
  type PhotoNoticeCode,
} from "@/app/chair/photos/photoNotices";
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

const chairPhotosPath = "/chair/photos";
// Dummy origin used only to parse/normalize relative return paths.
const internalUrlBase = "https://chair.invalid";

async function requireChairSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(CHAIR_COOKIE)?.value;
  const isAuthorized = await verifyChairToken(token);

  if (!isAuthorized) {
    redirect("/chair/login");
  }
}

// Only same-app relative paths under /chair/photos are honored. Absolute URLs,
// protocol-relative paths, backslashes, and other routes fall back to the bare
// photos page so the returned navigation target can never leave the chair
// photos area.
function resolvePhotosReturnUrl(formData: FormData) {
  const returnTo = formData.get("returnTo");

  if (
    typeof returnTo === "string" &&
    returnTo.startsWith("/") &&
    !returnTo.startsWith("//") &&
    !returnTo.includes("\\")
  ) {
    const url = new URL(returnTo, internalUrlBase);

    if (
      url.pathname === chairPhotosPath ||
      url.pathname.startsWith(`${chairPhotosPath}/`)
    ) {
      return url;
    }
  }

  return new URL(chairPhotosPath, internalUrlBase);
}

// Returns the notice URL instead of calling redirect() so the client hook can
// navigate with scroll preservation (router.replace with scroll: false).
async function runPhotoAction(
  formData: FormData,
  successOutcome: PhotoNoticeCode,
  operation: () => Promise<void>,
): Promise<ChairActionResult> {
  let outcome: PhotoNoticeCode = "action-failed";

  try {
    await operation();
    outcome = successOutcome;
  } catch (error) {
    console.error("chair photo action failed", error);
    outcome = "action-failed";
  }

  const url = resolvePhotosReturnUrl(formData);
  url.searchParams.set(PHOTOS_NOTICE_PARAM, outcome);
  return { redirectTo: `${url.pathname}${url.search}` };
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

  return runPhotoAction(formData, "approved", async () => {
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
  });
}

export async function rejectPhoto(formData: FormData) {
  await requireChairSession();

  return runPhotoAction(formData, "rejected", async () => {
    const parsed = photoIdSchema.parse({
      id: formData.get("id"),
    });

    await deletePendingPhotoById(
      parsed.id,
      "Only pending photos can be rejected.",
    );

    revalidatePath("/chair/photos");
    revalidatePath("/chair/remembrance");
  });
}

export async function returnApprovedPhotoToPending(formData: FormData) {
  await requireChairSession();

  return runPhotoAction(formData, "returned", async () => {
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
  });
}

export async function deletePendingPhoto(formData: FormData) {
  await requireChairSession();

  return runPhotoAction(formData, "deleted", async () => {
    const parsed = photoIdSchema.parse({
      id: formData.get("id"),
    });

    await deletePendingPhotoById(
      parsed.id,
      "Only pending photos can be deleted.",
    );

    revalidatePath("/chair/photos");
    revalidatePath("/chair/remembrance");
  });
}
