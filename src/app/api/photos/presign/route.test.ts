import { afterEach, describe, expect, it, vi } from "vitest";

const {
  createPendingPhotoUpload,
  createRemembrancePhotoUpload,
  feedbackFindFirst,
  photoCreate,
} = vi.hoisted(() => ({
  createPendingPhotoUpload: vi.fn(),
  createRemembrancePhotoUpload: vi.fn(),
  feedbackFindFirst: vi.fn(),
  photoCreate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    feedback: {
      findFirst: feedbackFindFirst,
    },
    photoSubmission: {
      create: photoCreate,
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
});
