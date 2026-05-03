import { db } from "@/lib/db";
import { createPendingPhotoUpload, isAllowedImageType } from "@/lib/s3";
import { NextResponse } from "next/server";
import { z } from "zod";

const presignSchema = z.object({
  fileName: z.string().trim().min(1),
  contentType: z.string().trim().min(1),
  submitterName: z.string().trim().min(1),
  submitterEmail: z.string().trim().email(),
  caption: z.string().trim().optional(),
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

  try {
    const upload = await createPendingPhotoUpload(
      parsed.data.fileName,
      parsed.data.contentType,
    );
    const submission = await db.photoSubmission.create({
      data: {
        submitterName: parsed.data.submitterName,
        submitterEmail: parsed.data.submitterEmail.toLowerCase(),
        caption: parsed.data.caption,
        s3Key: upload.key,
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
