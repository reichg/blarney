import {
  buildChairRemembranceArchive,
  listChairRemembrancePhotosForDownload,
  REMEMBRANCE_ZIP_FILE_NAME,
} from "@/lib/chairPhotos";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const remembranceBulkDownloadSchema = z
  .object({
    ids: z.array(z.string().trim().min(1)).max(200).optional(),
    mode: z.enum(["selected", "all"]).default("selected"),
  })
  .superRefine((value, context) => {
    if (value.mode === "selected" && (!value.ids || value.ids.length === 0)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select at least one remembrance photo.",
        path: ["ids"],
      });
    }

    if (value.mode === "all" && value.ids) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Do not send ids when requesting all remembrance photos.",
        path: ["ids"],
      });
    }
  })
  .transform((value) => ({
    mode: value.mode,
    ids: value.ids ? Array.from(new Set(value.ids)) : undefined,
  }));

export async function POST(request: Request) {
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
