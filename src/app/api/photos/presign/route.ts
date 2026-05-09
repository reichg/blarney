import { db } from "@/lib/db";
import {
  isAllowedImageType,
  isAllowedPhotoSize,
  photoUploadLimitLabel,
} from "@/lib/photoUpload";
import { REMEMBRANCE_FEEDBACK_CATEGORY } from "@/lib/remembrance";
import {
  createPendingPhotoUpload,
  createRemembrancePhotoUpload,
} from "@/lib/s3";
import { NextResponse } from "next/server";
import { presignSchema } from "./type";

export async function POST(request: Request) {
  const parsed = presignSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success || !isAllowedImageType(parsed.data.contentType)) {
    return NextResponse.json(
      { message: "Valid image details are required." },
      { status: 400 },
    );
  }

  if (!isAllowedPhotoSize(parsed.data.fileSize)) {
    return NextResponse.json(
      { message: `Photos must be ${photoUploadLimitLabel} or smaller.` },
      { status: 400 },
    );
  }

  try {
    let feedbackId: string | undefined;
    const isRemembranceUpload = parsed.data.purpose === "REMEMBRANCE";

    if (isRemembranceUpload) {
      const remembranceFeedback = await db.feedback.findFirst({
        where: {
          id: parsed.data.feedbackId,
          category: REMEMBRANCE_FEEDBACK_CATEGORY,
        },
        select: { id: true },
      });

      if (!remembranceFeedback) {
        return NextResponse.json(
          { message: "Valid remembrance context is required." },
          { status: 400 },
        );
      }

      feedbackId = remembranceFeedback.id;
    }

    const upload = isRemembranceUpload
      ? await createRemembrancePhotoUpload(
          parsed.data.fileName,
          parsed.data.contentType,
          parsed.data.fileSize,
        )
      : await createPendingPhotoUpload(
          parsed.data.fileName,
          parsed.data.contentType,
          parsed.data.fileSize,
        );
    const submission = await db.photoSubmission.create({
      data: {
        submitterName: parsed.data.submitterName,
        submitterEmail: parsed.data.submitterEmail.toLowerCase(),
        caption: parsed.data.caption,
        feedbackId,
        purpose: parsed.data.purpose,
        s3Key: upload.key,
        ...(isRemembranceUpload
          ? {
              approvedAt: new Date(),
              status: "APPROVED",
            }
          : {}),
      },
    });

    return NextResponse.json({
      photoId: submission.id,
      uploadUrl: upload.uploadUrl,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Photo upload could not be prepared.",
      },
      { status: 500 },
    );
  }
}
