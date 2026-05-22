import { requireChairApiAuth } from "@/lib/chairAuth.server";
import { resolveMarketplaceListingImageUrl } from "@/lib/marketplaceListingImage";
import { uploadMarketplaceListingImageObject } from "@/lib/s3";
import { NextRequest, NextResponse } from "next/server";

const noStoreHeaders = {
  "Cache-Control": "no-store",
};

export async function POST(request: NextRequest) {
  const unauthorized = await requireChairApiAuth(request);

  if (unauthorized) {
    return unauthorized;
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      { message: "Valid listing image details are required." },
      { headers: noStoreHeaders, status: 400 },
    );
  }

  try {
    const upload = await uploadMarketplaceListingImageObject(
      file.name,
      file.type,
      file.size,
      new Uint8Array(await file.arrayBuffer()),
    );

    return NextResponse.json(
      {
        imageKey: upload.key,
        imageUrl: resolveMarketplaceListingImageUrl(upload.key),
      },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    const message =
      error instanceof Error &&
      (error.message === "Unsupported image type." ||
        error.message.includes("Photos must be"))
        ? error.message
        : "Listing image upload could not be prepared.";
    const status =
      message === "Listing image upload could not be prepared." ? 500 : 400;

    return NextResponse.json(
      { message },
      { headers: noStoreHeaders, status },
    );
  }
}