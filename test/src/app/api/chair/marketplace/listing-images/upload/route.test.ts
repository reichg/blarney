import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { requireChairApiAuth, uploadMarketplaceListingImageObject } = vi.hoisted(
  () => ({
    requireChairApiAuth: vi.fn(),
    uploadMarketplaceListingImageObject: vi.fn(),
  }),
);

vi.mock("@/lib/chairAuth.server", () => ({
  requireChairApiAuth,
}));

vi.mock("@/lib/s3", () => ({
  uploadMarketplaceListingImageObject,
}));

import { POST } from "@/app/api/chair/marketplace/listing-images/upload/route";
import { getMarketplaceListingImageViewPath } from "@/lib/marketplaceListingImage";

beforeEach(() => {
  requireChairApiAuth.mockResolvedValue(null);
});

afterEach(() => {
  vi.clearAllMocks();
});

function buildUploadRequest(file: File) {
  const formData = new FormData();
  formData.set("file", file);

  return new NextRequest(
    "http://localhost:3000/api/chair/marketplace/listing-images/upload",
    {
      body: formData,
      method: "POST",
    },
  );
}

describe("chair marketplace listing image upload route", () => {
  it("returns unauthorized before uploading the listing image", async () => {
    requireChairApiAuth.mockResolvedValue(
      NextResponse.json(
        { message: "Unauthorized." },
        {
          headers: {
            "Cache-Control": "no-store",
          },
          status: 401,
        },
      ),
    );

    const response = await POST(
      buildUploadRequest(
        new File(["hoodie"], "hoodie.png", { type: "image/png" }),
      ),
    );

    await expect(response.json()).resolves.toEqual({
      message: "Unauthorized.",
    });
    expect(response.status).toBe(401);
    expect(uploadMarketplaceListingImageObject).not.toHaveBeenCalled();
  });

  it("uploads valid listing images through the server route", async () => {
    uploadMarketplaceListingImageObject.mockResolvedValue({
      key: "/listing/123e4567-e89b-12d3-a456-426614174000-hoodie.png",
    });

    const response = await POST(
      buildUploadRequest(
        new File(["hoodie"], "hoodie.png", { type: "image/png" }),
      ),
    );

    expect(uploadMarketplaceListingImageObject).toHaveBeenCalledWith(
      "hoodie.png",
      "image/png",
      6,
      expect.any(Uint8Array),
    );
    await expect(response.json()).resolves.toEqual({
      imageKey: "/listing/123e4567-e89b-12d3-a456-426614174000-hoodie.png",
      imageUrl: getMarketplaceListingImageViewPath(
        "/listing/123e4567-e89b-12d3-a456-426614174000-hoodie.png",
      ),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("rejects missing listing image uploads", async () => {
    const response = await POST(
      new NextRequest(
        "http://localhost:3000/api/chair/marketplace/listing-images/upload",
        {
          body: new FormData(),
          method: "POST",
        },
      ),
    );

    await expect(response.json()).resolves.toEqual({
      message: "Valid listing image details are required.",
    });
    expect(response.status).toBe(400);
    expect(uploadMarketplaceListingImageObject).not.toHaveBeenCalled();
  });

  it("returns a validation error when the uploaded listing image type is rejected", async () => {
    uploadMarketplaceListingImageObject.mockRejectedValue(
      new Error("Unsupported image type."),
    );

    const response = await POST(
      buildUploadRequest(
        new File(["hoodie"], "hoodie.svg", { type: "image/svg+xml" }),
      ),
    );

    await expect(response.json()).resolves.toEqual({
      message: "Unsupported image type.",
    });
    expect(response.status).toBe(400);
  });

  it("returns a safe generic error when the server-side upload fails", async () => {
    uploadMarketplaceListingImageObject.mockRejectedValue(
      new Error("AWS_S3_BUCKET must be configured for photo uploads."),
    );

    const response = await POST(
      buildUploadRequest(
        new File(["hoodie"], "hoodie.png", { type: "image/png" }),
      ),
    );

    await expect(response.json()).resolves.toEqual({
      message: "Listing image upload could not be prepared.",
    });
    expect(response.status).toBe(500);
  });
});
