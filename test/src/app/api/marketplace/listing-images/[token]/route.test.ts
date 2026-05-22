import { afterEach, describe, expect, it, vi } from "vitest";

const { getPhotoReadUrl } = vi.hoisted(() => ({
  getPhotoReadUrl: vi.fn(),
}));

vi.mock("@/lib/s3", () => ({
  getPhotoReadUrl,
}));

import { GET } from "@/app/api/marketplace/listing-images/[token]/route";
import { encodeMarketplaceListingImageToken } from "@/lib/marketplaceListingImage";

afterEach(() => {
  vi.clearAllMocks();
});

describe("marketplace listing image route", () => {
  it("returns not found for invalid listing image tokens", async () => {
    const response = await GET(new Request("http://localhost:3000"), {
      params: Promise.resolve({ token: "bad-token" }),
    });

    await expect(response.json()).resolves.toEqual({
      message: "Listing image not found.",
    });
    expect(response.status).toBe(404);
    expect(getPhotoReadUrl).not.toHaveBeenCalled();
  });

  it("redirects valid listing image tokens to a signed S3 read url", async () => {
    const imageKey = "/listing/123e4567-e89b-12d3-a456-426614174000-hoodie.png";
    getPhotoReadUrl.mockResolvedValue("https://example.com/read/hoodie");

    const response = await GET(new Request("http://localhost:3000"), {
      params: Promise.resolve({
        token: encodeMarketplaceListingImageToken(imageKey),
      }),
    });

    expect(getPhotoReadUrl).toHaveBeenCalledWith(imageKey);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://example.com/read/hoodie",
    );
  });
});
