import { afterEach, describe, expect, it, vi } from "vitest";

const { getPhotoObjectBytes, photoFindFirst } = vi.hoisted(() => ({
  getPhotoObjectBytes: vi.fn(),
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
  getPhotoObjectBytes,
}));

import { GET } from "@/app/api/chair/remembrance/[id]/download/route";

function buildContext(id: string) {
  return {
    params: Promise.resolve({ id }),
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("chair remembrance single download route", () => {
  it("downloads a remembrance photo as an attachment", async () => {
    photoFindFirst.mockResolvedValue({
      id: "photo-1",
      caption: "Pat and Mike",
      createdAt: new Date("2026-05-04T12:00:00.000Z"),
      approvedS3Key: null,
      s3Key:
        "remembrance/123e4567-e89b-12d3-a456-426614174000-family-photo.jpg",
    });
    getPhotoObjectBytes.mockResolvedValue({
      body: Buffer.from("photo-bytes"),
      contentLength: 11,
      contentType: "image/jpeg",
    });

    const response = await GET(
      new Request(
        "http://localhost:3000/api/chair/remembrance/photo-1/download",
      ),
      buildContext("photo-1"),
    );

    expect(photoFindFirst).toHaveBeenCalledWith({
      where: {
        id: "photo-1",
        purpose: "REMEMBRANCE",
      },
      select: {
        approvedS3Key: true,
        caption: true,
        createdAt: true,
        id: true,
        s3Key: true,
      },
    });
    expect(getPhotoObjectBytes).toHaveBeenCalledWith(
      "remembrance/123e4567-e89b-12d3-a456-426614174000-family-photo.jpg",
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="pat-and-mike.jpg"',
    );
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe(
      "photo-bytes",
    );
  });

  it("returns not found for non-remembrance ids", async () => {
    photoFindFirst.mockResolvedValue(null);

    const response = await GET(
      new Request(
        "http://localhost:3000/api/chair/remembrance/photo-1/download",
      ),
      buildContext("photo-1"),
    );

    await expect(response.json()).resolves.toEqual({
      message: "Photo not found.",
    });
    expect(response.status).toBe(404);
    expect(getPhotoObjectBytes).not.toHaveBeenCalled();
  });
});
