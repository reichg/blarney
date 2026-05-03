import { db } from "@/lib/db";
import { getPhotoReadUrl } from "@/lib/s3";
import { NextResponse } from "next/server";

type PhotoViewContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: PhotoViewContext) {
  const { id } = await context.params;
  const photo = await db.photoSubmission.findFirst({
    where: { id, status: "APPROVED" },
  });

  if (!photo) {
    return NextResponse.json({ message: "Photo not found." }, { status: 404 });
  }

  const readUrl = await getPhotoReadUrl(photo.approvedS3Key ?? photo.s3Key);
  return NextResponse.redirect(readUrl);
}
