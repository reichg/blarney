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
import { z } from "zod";

function normalizeOptionalString(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();

    return trimmed.length ? trimmed : undefined;
  }

  return value ?? undefined;
}

const presignSchema = z
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
