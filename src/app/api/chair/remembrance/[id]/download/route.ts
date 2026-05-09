import { requireChairApiAuth } from "@/lib/chairAuth.server";
import {
  buildChairRemembranceDownloadFileName,
  findChairRemembrancePhotoForDownload,
  getChairRemembrancePhotoObjectKey,
} from "@/lib/chairPhotos";
import { getPhotoObjectBytes } from "@/lib/s3";
import { NextRequest, NextResponse } from "next/server";
import { type ChairRemembranceDownloadContext } from "./type";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: ChairRemembranceDownloadContext,
) {
  const unauthorized = await requireChairApiAuth(request);

  if (unauthorized) {
    return unauthorized;
  }

  const { id } = await context.params;
  const photo = await findChairRemembrancePhotoForDownload(id);

  if (!photo) {
    return NextResponse.json({ message: "Photo not found." }, { status: 404 });
  }

  try {
    const object = await getPhotoObjectBytes(
      getChairRemembrancePhotoObjectKey(photo),
    );
    const fileName = buildChairRemembranceDownloadFileName(photo);

    return new NextResponse(object.body, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": `${object.contentLength}`,
        "Content-Type": object.contentType,
      },
    });
  } catch {
    return NextResponse.json(
      { message: "Photo download failed." },
      { status: 500 },
    );
  }
}
