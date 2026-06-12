import {
  approvePhoto,
  deletePendingPhoto,
  rejectPhoto,
  returnApprovedPhotoToPending,
} from "@/app/actions/chairPhotos";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";

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
  // Mirrors next/navigation: redirect() throws, which is how the auth guard
  // bails out before the action body runs.
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

function buildReviewFormData(returnTo?: string) {
  const formData = new FormData();
  formData.set("id", "photo-1");
  formData.set("reviewNotes", "Chair review notes");
  if (returnTo !== undefined) {
    formData.set("returnTo", returnTo);
  }
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

function mockPendingPhoto() {
  photoFindUniqueOrThrow.mockResolvedValue({
    id: "photo-1",
    s3Key: "pending/photo-1.jpg",
    status: "PENDING",
  });
}

let consoleErrorSpy: MockInstance;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  cookies.mockResolvedValue({
    get: vi.fn().mockReturnValue({ value: "chair-token" }),
  });
  verifyChairToken.mockResolvedValue(true);
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
  vi.clearAllMocks();
});

describe("chair photo actions", () => {
  it("approves a pending photo by moving it into the approved prefix", async () => {
    mockPendingPhoto();
    movePendingPhotoToApproved.mockResolvedValue("approved/photo-1.jpg");

    // Resolving (never throwing) is the scroll-preservation contract: the
    // client hook navigates from the returned URL instead of a thrown redirect.
    await expect(approvePhoto(buildReviewFormData())).resolves.toEqual({
      redirectTo: "/chair/photos?photos=approved",
    });

    expect(redirect).not.toHaveBeenCalled();
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
    mockPendingPhoto();
    movePendingPhotoToApproved.mockResolvedValue("approved/photo-1.jpg");

    await expect(approvePhoto(buildReviewFormDataWithoutNotes())).resolves.toEqual(
      { redirectTo: "/chair/photos?photos=approved" },
    );

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
    ).resolves.toEqual({ redirectTo: "/chair/photos?photos=returned" });

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

  it("rejects a pending photo by deleting it from S3 and removing the database row", async () => {
    mockPendingPhoto();

    await expect(rejectPhoto(buildReviewFormData())).resolves.toEqual({
      redirectTo: "/chair/photos?photos=rejected",
    });

    expect(deletePhotoObject).toHaveBeenCalledWith("pending/photo-1.jpg");
    expect(photoDelete).toHaveBeenCalledWith({
      where: { id: "photo-1" },
    });
    expect(photoUpdate).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/chair/photos");
    expect(revalidatePath).toHaveBeenCalledWith("/chair/remembrance");
  });

  it("deletes a pending photo from S3 and then removes the database row", async () => {
    mockPendingPhoto();

    await expect(deletePendingPhoto(buildIdFormData())).resolves.toEqual({
      redirectTo: "/chair/photos?photos=deleted",
    });

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

  describe("failure outcomes", () => {
    it("resolves with action-failed when approving a photo that is not pending", async () => {
      photoFindUniqueOrThrow.mockResolvedValue({
        id: "photo-1",
        s3Key: "pending/photo-1.jpg",
        status: "APPROVED",
      });

      await expect(approvePhoto(buildReviewFormData())).resolves.toEqual({
        redirectTo: "/chair/photos?photos=action-failed",
      });

      expect(movePendingPhotoToApproved).not.toHaveBeenCalled();
      expect(photoUpdate).not.toHaveBeenCalled();
      expect(revalidatePath).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("resolves with action-failed and keeps the row when the S3 delete fails", async () => {
      mockPendingPhoto();
      // Once: vi.clearAllMocks() does not remove persistent implementations.
      deletePhotoObject.mockRejectedValueOnce(new Error("s3 unavailable"));

      await expect(rejectPhoto(buildReviewFormData())).resolves.toEqual({
        redirectTo: "/chair/photos?photos=action-failed",
      });

      expect(photoDelete).not.toHaveBeenCalled();
      expect(revalidatePath).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe("returnTo sanitization", () => {
    it("preserves a relative /chair/photos return path and appends the notice code", async () => {
      mockPendingPhoto();

      await expect(
        rejectPhoto(buildReviewFormData("/chair/photos?status=pending&page=2")),
      ).resolves.toEqual({
        redirectTo: "/chair/photos?status=pending&page=2&photos=rejected",
      });

      expect(redirect).not.toHaveBeenCalled();
      expect(deletePhotoObject).toHaveBeenCalledWith("pending/photo-1.jpg");
    });

    it.each([
      "https://evil.test/x",
      "//evil.test",
      "/chair/photos\\..",
      "/chair/registrations",
    ])("falls back to /chair/photos for unsafe returnTo %s", async (returnTo) => {
      mockPendingPhoto();

      await expect(rejectPhoto(buildReviewFormData(returnTo))).resolves.toEqual(
        { redirectTo: "/chair/photos?photos=rejected" },
      );

      expect(redirect).not.toHaveBeenCalled();
    });
  });
});
