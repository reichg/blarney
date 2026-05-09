import { unzipSync } from "fflate";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const { getPhotoObjectBytes, photoFindMany, requireChairApiAuth } = vi.hoisted(
  () => ({
    getPhotoObjectBytes: vi.fn(),
    photoFindMany: vi.fn(),
    requireChairApiAuth: vi.fn(async () => null),
  }),
);

vi.mock("@/lib/chairAuth.server", () => ({
  requireChairApiAuth,
}));

vi.mock("@/lib/db", () => ({
  db: {
    photoSubmission: {
      findMany: photoFindMany,
    },
  },
}));

vi.mock("@/lib/s3", () => ({
  getPhotoObjectBytes,
}));

import { POST } from "@/app/api/chair/remembrance/download/route";

afterEach(() => {
  vi.clearAllMocks();
});

describe("chair remembrance bulk download route", () => {
  it("downloads selected remembrance photos as a zip in the remembrance folder", async () => {
    photoFindMany.mockResolvedValue([
      {
        id: "photo-1",
        caption: "Pat and Mike",
        createdAt: new Date("2026-05-01T00:00:00.000Z"),
        approvedS3Key: null,
        s3Key:
          "remembrance/123e4567-e89b-12d3-a456-426614174000-family-photo.jpg",
      },
      {
        id: "photo-2",
        caption: null,
        createdAt: new Date("2026-05-02T00:00:00.000Z"),
        approvedS3Key:
          "approved/123e4567-e89b-12d3-a456-426614174001-candids.png",
        s3Key: "pending/123e4567-e89b-12d3-a456-426614174001-candids.png",
      },
    ]);
    getPhotoObjectBytes.mockImplementation(async (key: string) => ({
      body: Buffer.from(key.endsWith(".jpg") ? "jpg-bytes" : "png-bytes"),
      contentLength: key.endsWith(".jpg") ? 9 : 9,
      contentType: key.endsWith(".jpg") ? "image/jpeg" : "image/png",
    }));

    const response = await POST(
      new NextRequest("http://localhost:3000/api/chair/remembrance/download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids: ["photo-1", "photo-2"] }),
      }),
    );

    expect(requireChairApiAuth).toHaveBeenCalledTimes(1);

    expect(photoFindMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["photo-1", "photo-2"] },
        purpose: "REMEMBRANCE",
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
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
    expect(getPhotoObjectBytes).toHaveBeenCalledWith(
      "approved/123e4567-e89b-12d3-a456-426614174001-candids.png",
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="blarney-remembrance.zip"',
    );
    expect(response.headers.get("content-type")).toBe("application/zip");

    const archiveEntries = unzipSync(
      new Uint8Array(await response.arrayBuffer()),
    );
    const archiveNames = Object.keys(archiveEntries).sort();

    expect(archiveNames).toEqual([
      "blarney-remembrance/candids.png",
      "blarney-remembrance/pat-and-mike.jpg",
    ]);
    expect(
      Buffer.from(
        archiveEntries["blarney-remembrance/pat-and-mike.jpg"],
      ).toString(),
    ).toBe("jpg-bytes");
    expect(
      Buffer.from(archiveEntries["blarney-remembrance/candids.png"]).toString(),
    ).toBe("png-bytes");
  });

  it("supports downloading all remembrance photos when mode is all", async () => {
    photoFindMany.mockResolvedValue([
      {
        id: "photo-1",
        caption: null,
        createdAt: new Date("2026-05-01T00:00:00.000Z"),
        approvedS3Key: null,
        s3Key:
          "remembrance/123e4567-e89b-12d3-a456-426614174000-family-photo.jpg",
      },
    ]);
    getPhotoObjectBytes.mockResolvedValue({
      body: Buffer.from("jpg-bytes"),
      contentLength: 9,
      contentType: "image/jpeg",
    });

    const response = await POST(
      new NextRequest("http://localhost:3000/api/chair/remembrance/download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mode: "all" }),
      }),
    );

    expect(requireChairApiAuth).toHaveBeenCalledTimes(1);

    expect(photoFindMany).toHaveBeenCalledWith({
      where: {
        purpose: "REMEMBRANCE",
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        approvedS3Key: true,
        caption: true,
        createdAt: true,
        id: true,
        s3Key: true,
      },
    });
    expect(response.status).toBe(200);
  });

  it("returns not found when selected ids are not all remembrance photos", async () => {
    photoFindMany.mockResolvedValue([
      {
        id: "photo-1",
        caption: null,
        createdAt: new Date("2026-05-01T00:00:00.000Z"),
        approvedS3Key: null,
        s3Key:
          "remembrance/123e4567-e89b-12d3-a456-426614174000-family-photo.jpg",
      },
    ]);

    const response = await POST(
      new NextRequest("http://localhost:3000/api/chair/remembrance/download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids: ["photo-1", "gallery-photo"] }),
      }),
    );

    expect(requireChairApiAuth).toHaveBeenCalledTimes(1);

    await expect(response.json()).resolves.toEqual({
      message: "One or more remembrance photos were not found.",
    });
    expect(response.status).toBe(404);
    expect(getPhotoObjectBytes).not.toHaveBeenCalled();
  });
});
