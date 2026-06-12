import { afterEach, describe, expect, it, vi } from "vitest";

const {
  createPendingPhotoUpload,
  createRemembrancePhotoUpload,
  feedbackFindFirst,
  photoCreate,
  photoFindFirst,
} = vi.hoisted(() => ({
  createPendingPhotoUpload: vi.fn(),
  createRemembrancePhotoUpload: vi.fn(),
  feedbackFindFirst: vi.fn(),
  photoCreate: vi.fn(),
  photoFindFirst: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    feedback: {
      findFirst: feedbackFindFirst,
    },
    photoSubmission: {
      create: photoCreate,
      findFirst: photoFindFirst,
    },
  },
}));

vi.mock("@/lib/s3", () => ({
  createPendingPhotoUpload,
  createRemembrancePhotoUpload,
}));

import { POST } from "@/app/api/photos/presign/route";

afterEach(() => {
  vi.clearAllMocks();
});

describe("photo presign route", () => {
  it("creates default gallery submissions without remembrance linkage", async () => {
    createPendingPhotoUpload.mockResolvedValue({
      key: "pending/gallery-photo.jpg",
      uploadUrl: "https://example.com/upload/gallery-photo",
    });
    photoCreate.mockResolvedValue({ id: "photo-1" });

    const response = await POST(
      new Request("http://localhost:3000/api/photos/presign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          caption: "",
          contentType: "image/jpeg",
          fileName: "gallery-photo.jpg",
          fileSize: 1024,
          submitterEmail: "PAT@EXAMPLE.COM",
          submitterName: " Pat ",
        }),
      }),
    );

    expect(feedbackFindFirst).not.toHaveBeenCalled();
    expect(createPendingPhotoUpload).toHaveBeenCalledWith(
      "gallery-photo.jpg",
      "image/jpeg",
      1024,
    );
    expect(createRemembrancePhotoUpload).not.toHaveBeenCalled();
    expect(photoCreate).toHaveBeenCalledWith({
      data: {
        caption: undefined,
        feedbackId: undefined,
        purpose: "GALLERY",
        s3Key: "pending/gallery-photo.jpg",
        submitterEmail: "pat@example.com",
        submitterName: "Pat",
      },
    });
    await expect(response.json()).resolves.toEqual({
      photoId: "photo-1",
      uploadUrl: "https://example.com/upload/gallery-photo",
    });
    expect(response.status).toBe(200);
  });

  it("creates remembrance submissions linked to a remembrance feedback row", async () => {
    feedbackFindFirst.mockResolvedValue({ id: "feedback-1" });
    createRemembrancePhotoUpload.mockResolvedValue({
      key: "remembrance/remembrance-photo.jpg",
      uploadUrl: "https://example.com/upload/remembrance-photo",
    });
    photoCreate.mockResolvedValue({ id: "photo-2" });

    const response = await POST(
      new Request("http://localhost:3000/api/photos/presign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contentType: "image/jpeg",
          feedbackId: "feedback-1",
          fileName: "remembrance-photo.jpg",
          fileSize: 2048,
          purpose: "REMEMBRANCE",
          submitterEmail: "pat@example.com",
          submitterName: "Pat",
        }),
      }),
    );

    expect(feedbackFindFirst).toHaveBeenCalledWith({
      where: {
        category: "In Remembrance",
        id: "feedback-1",
      },
      select: { id: true },
    });
    expect(createPendingPhotoUpload).not.toHaveBeenCalled();
    expect(createRemembrancePhotoUpload).toHaveBeenCalledWith(
      "remembrance-photo.jpg",
      "image/jpeg",
      2048,
    );
    expect(photoCreate).toHaveBeenCalledWith({
      data: {
        approvedAt: expect.any(Date),
        caption: undefined,
        feedbackId: "feedback-1",
        purpose: "REMEMBRANCE",
        s3Key: "remembrance/remembrance-photo.jpg",
        status: "APPROVED",
        submitterEmail: "pat@example.com",
        submitterName: "Pat",
      },
    });
    await expect(response.json()).resolves.toEqual({
      photoId: "photo-2",
      uploadUrl: "https://example.com/upload/remembrance-photo",
    });
    expect(response.status).toBe(200);
  });

  it("rejects remembrance uploads when the linked remembrance note is invalid", async () => {
    feedbackFindFirst.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost:3000/api/photos/presign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contentType: "image/jpeg",
          feedbackId: "feedback-1",
          fileName: "remembrance-photo.jpg",
          fileSize: 2048,
          purpose: "REMEMBRANCE",
          submitterEmail: "pat@example.com",
          submitterName: "Pat",
        }),
      }),
    );

    await expect(response.json()).resolves.toEqual({
      message: "Valid remembrance context is required.",
    });
    expect(response.status).toBe(400);
    expect(createPendingPhotoUpload).not.toHaveBeenCalled();
    expect(createRemembrancePhotoUpload).not.toHaveBeenCalled();
    expect(photoCreate).not.toHaveBeenCalled();
  });

  describe("contentHash duplicate detection", () => {
    const contentHash = "a".repeat(64);

    function galleryRequest(body: Record<string, unknown>) {
      return new Request("http://localhost:3000/api/photos/presign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          caption: "",
          contentType: "image/jpeg",
          fileName: "gallery-photo.jpg",
          fileSize: 1024,
          submitterEmail: "pat@example.com",
          submitterName: "Pat",
          ...body,
        }),
      });
    }

    it("rejects a duplicate gallery photo with only a generic message", async () => {
      photoFindFirst.mockResolvedValue({ id: "photo-existing" });

      const response = await POST(galleryRequest({ contentHash }));

      expect(photoFindFirst).toHaveBeenCalledWith({
        where: {
          purpose: "GALLERY",
          contentHash,
          status: { not: "REJECTED" },
        },
        select: { id: true },
      });
      await expect(response.json()).resolves.toEqual({
        message: "This photo has already been submitted.",
      });
      expect(response.status).toBe(409);
      expect(createPendingPhotoUpload).not.toHaveBeenCalled();
      expect(photoCreate).not.toHaveBeenCalled();
    });

    it("allows resubmitting a gallery photo whose prior submission was rejected", async () => {
      // The dedup lookup excludes REJECTED rows, so it finds no duplicate.
      photoFindFirst.mockResolvedValue(null);
      createPendingPhotoUpload.mockResolvedValue({
        key: "pending/gallery-photo.jpg",
        uploadUrl: "https://example.com/upload/gallery-photo",
      });
      photoCreate.mockResolvedValue({ id: "photo-3" });

      const response = await POST(galleryRequest({ contentHash }));

      expect(photoFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: { not: "REJECTED" } }),
        }),
      );
      expect(response.status).toBe(200);
      expect(photoCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ contentHash }),
      });
    });

    it("rejects a duplicate remembrance photo for the same remembrance note", async () => {
      feedbackFindFirst.mockResolvedValue({ id: "feedback-1" });
      photoFindFirst.mockResolvedValue({ id: "photo-existing" });

      const response = await POST(
        galleryRequest({
          contentHash,
          feedbackId: "feedback-1",
          purpose: "REMEMBRANCE",
        }),
      );

      expect(photoFindFirst).toHaveBeenCalledWith({
        where: {
          purpose: "REMEMBRANCE",
          contentHash,
          feedbackId: "feedback-1",
        },
        select: { id: true },
      });
      await expect(response.json()).resolves.toEqual({
        message: "This photo has already been submitted.",
      });
      expect(response.status).toBe(409);
      expect(createRemembrancePhotoUpload).not.toHaveBeenCalled();
      expect(photoCreate).not.toHaveBeenCalled();
    });

    it("allows the same remembrance photo hash under a different remembrance note", async () => {
      feedbackFindFirst.mockResolvedValue({ id: "feedback-2" });
      photoFindFirst.mockResolvedValue(null);
      createRemembrancePhotoUpload.mockResolvedValue({
        key: "remembrance/remembrance-photo.jpg",
        uploadUrl: "https://example.com/upload/remembrance-photo",
      });
      photoCreate.mockResolvedValue({ id: "photo-4" });

      const response = await POST(
        galleryRequest({
          contentHash,
          feedbackId: "feedback-2",
          purpose: "REMEMBRANCE",
        }),
      );

      expect(photoFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ feedbackId: "feedback-2" }),
        }),
      );
      expect(response.status).toBe(200);
      expect(photoCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ contentHash }),
      });
    });

    it("skips the duplicate check when no contentHash is supplied", async () => {
      createPendingPhotoUpload.mockResolvedValue({
        key: "pending/gallery-photo.jpg",
        uploadUrl: "https://example.com/upload/gallery-photo",
      });
      photoCreate.mockResolvedValue({ id: "photo-5" });

      const response = await POST(galleryRequest({}));

      expect(photoFindFirst).not.toHaveBeenCalled();
      expect(response.status).toBe(200);
      expect(photoCreate.mock.calls[0][0].data.contentHash).toBeUndefined();
    });

    it("rejects a malformed contentHash before any lookup", async () => {
      const response = await POST(
        galleryRequest({ contentHash: "not-a-sha256-hash" }),
      );

      await expect(response.json()).resolves.toEqual({
        message: "Valid image details are required.",
      });
      expect(response.status).toBe(400);
      expect(photoFindFirst).not.toHaveBeenCalled();
      expect(createPendingPhotoUpload).not.toHaveBeenCalled();
      expect(photoCreate).not.toHaveBeenCalled();
    });
  });

  it("returns a generic message when preparing the upload fails", async () => {
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    createPendingPhotoUpload.mockRejectedValue(new Error("bucket offline"));

    const response = await POST(
      new Request("http://localhost:3000/api/photos/presign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          caption: "",
          contentType: "image/jpeg",
          fileName: "gallery-photo.jpg",
          fileSize: 1024,
          submitterEmail: "pat@example.com",
          submitterName: "Pat",
        }),
      }),
    );

    await expect(response.json()).resolves.toEqual({
      message: "Photo upload could not be prepared.",
    });
    expect(response.status).toBe(500);

    errorSpy.mockRestore();
  });
});
