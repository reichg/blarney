import { decodeMarketplaceListingImageToken } from "@/lib/marketplaceListingImage";
import { getPhotoReadUrl } from "@/lib/s3";
import { NextResponse } from "next/server";
import { type MarketplaceListingImageViewContext } from "./type";

const noStoreHeaders = {
  "Cache-Control": "no-store",
};

export async function GET(
  _request: Request,
  context: MarketplaceListingImageViewContext,
) {
  const { token } = await context.params;
  const key = decodeMarketplaceListingImageToken(token);

  if (!key) {
    return NextResponse.json(
      { message: "Listing image not found." },
      { headers: noStoreHeaders, status: 404 },
    );
  }

  const readUrl = await getPhotoReadUrl(key);
  return NextResponse.redirect(readUrl, { headers: noStoreHeaders });
}
