import { requireChairApiAuth } from "@/lib/chairAuth.server";
import { db } from "@/lib/db";
import { getPhotoReadUrl } from "@/lib/s3";
import { NextRequest, NextResponse } from "next/server";
import { type ChairPhotoViewContext } from "./type";

export async function GET(
  request: NextRequest,
  context: ChairPhotoViewContext,
) {
  const unauthorized = await requireChairApiAuth(request);

  if (unauthorized) {
    return unauthorized;
  }

  const { id } = await context.params;
  const photo = await db.photoSubmission.findUnique({ where: { id } });

  if (!photo) {
    return NextResponse.json({ message: "Photo not found." }, { status: 404 });
  }

  const readUrl = await getPhotoReadUrl(photo.approvedS3Key ?? photo.s3Key);
  return NextResponse.redirect(readUrl);
}
