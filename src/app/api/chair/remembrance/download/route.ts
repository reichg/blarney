import { requireChairApiAuth } from "@/lib/chairAuth.server";
import {
  buildChairRemembranceArchive,
  listChairRemembrancePhotosForDownload,
  REMEMBRANCE_ZIP_FILE_NAME,
} from "@/lib/chairPhotos";
import { NextRequest, NextResponse } from "next/server";
import { remembranceBulkDownloadSchema } from "./type";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const unauthorized = await requireChairApiAuth(request);

  if (unauthorized) {
    return unauthorized;
  }

  const parsed = remembranceBulkDownloadSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Valid remembrance download details are required." },
      { status: 400 },
    );
  }

  const ids = parsed.data.mode === "selected" ? parsed.data.ids : undefined;
  const photos = await listChairRemembrancePhotosForDownload(ids);

  if (!photos.length) {
    return NextResponse.json(
      { message: "Remembrance photos not found." },
      { status: 404 },
    );
  }

  if (ids && photos.length !== ids.length) {
    return NextResponse.json(
      { message: "One or more remembrance photos were not found." },
      { status: 404 },
    );
  }

  try {
    const archive = await buildChairRemembranceArchive(photos);

    return new NextResponse(archive, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${REMEMBRANCE_ZIP_FILE_NAME}"`,
        "Content-Length": `${archive.byteLength}`,
        "Content-Type": "application/zip",
      },
    });
  } catch {
    return NextResponse.json(
      { message: "Remembrance archive download failed." },
      { status: 500 },
    );
  }
}
