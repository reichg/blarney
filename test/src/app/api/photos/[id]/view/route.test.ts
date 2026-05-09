import { afterEach, describe, expect, it, vi } from "vitest";

const { getPhotoReadUrl, photoFindFirst } = vi.hoisted(() => ({
  getPhotoReadUrl: vi.fn(),
  photoFindFirst: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    photoSubmission: {
      findFirst: photoFindFirst,
    },
  },
}));

vi.mock("@/lib/s3", () => ({
  getPhotoReadUrl,
}));

import { GET } from "@/app/api/photos/[id]/view/route";

function buildContext(id: string) {
  return {
    params: Promise.resolve({ id }),
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("public photo view route", () => {
  it("redirects only approved gallery photos to a signed read URL", async () => {
    photoFindFirst.mockResolvedValue({
      approvedS3Key: "approved/photo-1.jpg",
    });
    getPhotoReadUrl.mockResolvedValue("https://example.com/photo-1");

    const response = await GET(
      new Request("http://localhost:3000/api/photos/photo-1/view"),
      buildContext("photo-1"),
    );

    expect(photoFindFirst).toHaveBeenCalledWith({
      where: {
        approvedS3Key: { not: null },
        id: "photo-1",
        purpose: "GALLERY",
        status: "APPROVED",
      },
      select: { approvedS3Key: true },
    });
    expect(getPhotoReadUrl).toHaveBeenCalledWith("approved/photo-1.jpg");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://example.com/photo-1",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("returns not found when no approved gallery photo exists", async () => {
    photoFindFirst.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost:3000/api/photos/photo-1/view"),
      buildContext("photo-1"),
    );

    await expect(response.json()).resolves.toEqual({
      message: "Photo not found.",
    });
    expect(response.status).toBe(404);
    expect(getPhotoReadUrl).not.toHaveBeenCalled();
  });

  it("returns not found when the stored key is outside the approved prefix", async () => {
    photoFindFirst.mockResolvedValue({
      approvedS3Key: "pending/photo-1.jpg",
    });

    const response = await GET(
      new Request("http://localhost:3000/api/photos/photo-1/view"),
      buildContext("photo-1"),
    );

    await expect(response.json()).resolves.toEqual({
      message: "Photo not found.",
    });
    expect(response.status).toBe(404);
    expect(getPhotoReadUrl).not.toHaveBeenCalled();
  });
});
