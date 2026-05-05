import {
  approvePhoto,
  deletePendingPhoto,
  returnApprovedPhotoToPending,
} from "@/app/actions/chairPhotos";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  photoDelete,
  photoFindUniqueOrThrow,
  photoUpdate,
  moveApprovedPhotoToPending,
  movePendingPhotoToApproved,
  deletePhotoObject,
  verifyChairToken,
  cookies,
  redirect,
  revalidatePath,
} = vi.hoisted(() => ({
  photoDelete: vi.fn(),
  photoFindUniqueOrThrow: vi.fn(),
  photoUpdate: vi.fn(),
  moveApprovedPhotoToPending: vi.fn(),
  movePendingPhotoToApproved: vi.fn(),
  deletePhotoObject: vi.fn(),
  verifyChairToken: vi.fn(),
  cookies: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  CHAIR_COOKIE: "blarney_chair_session",
  verifyChairToken,
}));

vi.mock("@/lib/db", () => ({
  db: {
    photoSubmission: {
      delete: photoDelete,
      findUniqueOrThrow: photoFindUniqueOrThrow,
      update: photoUpdate,
    },
  },
}));

vi.mock("@/lib/s3", () => ({
  approvedKeyFromPendingKey: (key: string) =>
    key.startsWith("pending/")
      ? key.replace(/^pending\//, "approved/")
      : `approved/${key}`,
  deletePhotoObject,
  moveApprovedPhotoToPending,
  movePendingPhotoToApproved,
}));

vi.mock("next/cache", () => ({
  revalidatePath,
}));

vi.mock("next/headers", () => ({
  cookies,
}));

vi.mock("next/navigation", () => ({
  redirect,
}));

function buildReviewFormData() {
  const formData = new FormData();
  formData.set("id", "photo-1");
  formData.set("reviewNotes", "Chair review notes");
  return formData;
}

function buildReviewFormDataWithoutNotes() {
  const formData = new FormData();
  formData.set("id", "photo-1");
  return formData;
}

function buildIdFormData() {
  const formData = new FormData();
  formData.set("id", "photo-1");
  return formData;
}

beforeEach(() => {
  cookies.mockResolvedValue({
    get: vi.fn().mockReturnValue({ value: "chair-token" }),
  });
  verifyChairToken.mockResolvedValue(true);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("chair photo actions", () => {
  it("approves a pending photo by moving it into the approved prefix", async () => {
    photoFindUniqueOrThrow.mockResolvedValue({
      id: "photo-1",
      s3Key: "pending/photo-1.jpg",
      status: "PENDING",
    });
    movePendingPhotoToApproved.mockResolvedValue("approved/photo-1.jpg");

    await expect(approvePhoto(buildReviewFormData())).resolves.toBeUndefined();

    expect(movePendingPhotoToApproved).toHaveBeenCalledWith(
      "pending/photo-1.jpg",
    );
    expect(photoUpdate).toHaveBeenCalledWith({
      where: { id: "photo-1" },
      data: {
        approvedAt: expect.any(Date),
        approvedS3Key: "approved/photo-1.jpg",
        reviewNotes: "Chair review notes",
        status: "APPROVED",
      },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/photos");
    expect(revalidatePath).toHaveBeenCalledWith("/chair/photos");
    expect(revalidatePath).toHaveBeenCalledWith("/chair/remembrance");
  });

  it("allows approving a pending photo without review notes", async () => {
    photoFindUniqueOrThrow.mockResolvedValue({
      id: "photo-1",
      s3Key: "pending/photo-1.jpg",
      status: "PENDING",
    });
    movePendingPhotoToApproved.mockResolvedValue("approved/photo-1.jpg");

    await expect(
      approvePhoto(buildReviewFormDataWithoutNotes()),
    ).resolves.toBeUndefined();

    expect(photoUpdate).toHaveBeenCalledWith({
      where: { id: "photo-1" },
      data: {
        approvedAt: expect.any(Date),
        approvedS3Key: "approved/photo-1.jpg",
        reviewNotes: undefined,
        status: "APPROVED",
      },
    });
  });

  it("returns an approved photo back to pending and clears its public metadata", async () => {
    photoFindUniqueOrThrow.mockResolvedValue({
      id: "photo-1",
      approvedS3Key: "approved/photo-1.jpg",
      s3Key: "pending/photo-1.jpg",
      status: "APPROVED",
    });
    moveApprovedPhotoToPending.mockResolvedValue("pending/photo-1.jpg");

    await expect(
      returnApprovedPhotoToPending(buildReviewFormData()),
    ).resolves.toBeUndefined();

    expect(moveApprovedPhotoToPending).toHaveBeenCalledWith(
      "approved/photo-1.jpg",
      "pending/photo-1.jpg",
    );
    expect(photoUpdate).toHaveBeenCalledWith({
      where: { id: "photo-1" },
      data: {
        approvedAt: null,
        approvedS3Key: null,
        reviewNotes: "Chair review notes",
        status: "PENDING",
      },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/photos");
    expect(revalidatePath).toHaveBeenCalledWith("/chair/photos");
    expect(revalidatePath).toHaveBeenCalledWith("/chair/remembrance");
  });

  it("deletes a pending photo from S3 and then removes the database row", async () => {
    photoFindUniqueOrThrow.mockResolvedValue({
      id: "photo-1",
      s3Key: "pending/photo-1.jpg",
      status: "PENDING",
    });

    await expect(
      deletePendingPhoto(buildIdFormData()),
    ).resolves.toBeUndefined();

    expect(deletePhotoObject).toHaveBeenCalledWith("pending/photo-1.jpg");
    expect(photoDelete).toHaveBeenCalledWith({
      where: { id: "photo-1" },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/chair/photos");
    expect(revalidatePath).toHaveBeenCalledWith("/chair/remembrance");
  });

  it("redirects to chair login before touching photo state when the session is missing", async () => {
    verifyChairToken.mockResolvedValue(false);

    await expect(approvePhoto(buildReviewFormData())).rejects.toThrow(
      "REDIRECT:/chair/login",
    );

    expect(redirect).toHaveBeenCalledWith("/chair/login");
    expect(photoFindUniqueOrThrow).not.toHaveBeenCalled();
  });
});
