import { db } from "@/lib/db";
import { getPhotoReadUrl } from "@/lib/s3";
import { NextResponse } from "next/server";

type PhotoViewContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: PhotoViewContext) {
  const { id } = await context.params;
  const photo = await db.photoSubmission.findFirst({
    where: {
      id,
      purpose: "GALLERY",
      status: "APPROVED",
      approvedS3Key: { not: null },
    },
    select: { approvedS3Key: true },
  });
  const approvedKey = photo?.approvedS3Key;

  if (!approvedKey || !approvedKey.startsWith("approved/")) {
    return NextResponse.json({ message: "Photo not found." }, { status: 404 });
  }

  const readUrl = await getPhotoReadUrl(approvedKey);
  const response = NextResponse.redirect(readUrl);

  response.headers.set("Cache-Control", "no-store");

  return response;
}
