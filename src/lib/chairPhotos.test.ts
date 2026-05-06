import { listReviewedChairGalleryPhotosPage } from "@/lib/chairPhotos";
import { parsePaginationParams } from "@/lib/pagination";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { photoCount, photoFindMany, getPhotoObjectBytes } = vi.hoisted(() => ({
  photoCount: vi.fn(),
  photoFindMany: vi.fn(),
  getPhotoObjectBytes: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    photoSubmission: {
      count: photoCount,
      findMany: photoFindMany,
    },
  },
}));

vi.mock("@/lib/s3", () => ({
  getPhotoObjectBytes,
}));

beforeEach(() => {
  photoFindMany.mockResolvedValue([]);
  photoCount.mockResolvedValue(0);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("listReviewedChairGalleryPhotosPage", () => {
  it("queries only approved gallery photos for the reviewed list", async () => {
    const pagination = parsePaginationParams(
      {
        reviewedPage: "2",
        reviewedPageSize: "10",
      },
      {
        pageKey: "reviewedPage",
        pageSizeKey: "reviewedPageSize",
      },
    );

    await expect(
      listReviewedChairGalleryPhotosPage(pagination),
    ).resolves.toMatchObject({
      photos: [],
      pagination: expect.objectContaining({
        totalCount: 0,
      }),
    });

    expect(photoFindMany).toHaveBeenCalledWith({
      where: {
        purpose: "GALLERY",
        status: "APPROVED",
      },
      include: {
        feedback: {
          select: {
            id: true,
            message: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: pagination.skip,
      take: pagination.take,
    });
    expect(photoCount).toHaveBeenCalledWith({
      where: {
        purpose: "GALLERY",
        status: "APPROVED",
      },
    });
  });
});
