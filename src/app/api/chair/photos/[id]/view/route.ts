import { db } from "@/lib/db";
import { getPhotoReadUrl } from "@/lib/s3";
import { NextResponse } from "next/server";

type ChairPhotoViewContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: ChairPhotoViewContext) {
  const { id } = await context.params;
  const photo = await db.photoSubmission.findUnique({ where: { id } });

  if (!photo) {
    return NextResponse.json({ message: "Photo not found." }, { status: 404 });
  }

  const readUrl = await getPhotoReadUrl(photo.approvedS3Key ?? photo.s3Key);
  return NextResponse.redirect(readUrl);
}
