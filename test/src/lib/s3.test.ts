import {
  createPendingPhotoUpload,
  createRemembrancePhotoUpload,
  deletePhotoObject,
  getPhotoObjectBytes,
  moveApprovedPhotoToPending,
  movePendingPhotoToApproved,
  uploadMarketplaceListingImageObject,
} from "@/lib/s3";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.fn();

function stubS3Env() {
  vi.stubEnv("AWS_S3_BUCKET", "blarney-test");
  vi.stubEnv("AWS_REGION", "us-west-1");
  vi.stubEnv("AWS_ACCESS_KEY_ID", "test-access-key");
  vi.stubEnv("AWS_SECRET_ACCESS_KEY", "test-secret-key");
}

beforeEach(() => {
  sendMock.mockReset();
  vi.spyOn(S3Client.prototype, "send").mockImplementation(sendMock as never);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("S3 photo uploads", () => {
  it("presigns browser PUT uploads without content length or empty checksums", async () => {
    stubS3Env();

    const upload = await createPendingPhotoUpload(
      "Four Stack.png",
      "image/png",
      12345,
    );
    const uploadUrl = new URL(upload.uploadUrl);

    expect(upload.key).toMatch(/^pending\/[a-f0-9-]+-four-stack\.png$/);
    expect(uploadUrl.searchParams.get("X-Amz-SignedHeaders")).toBe("host");
    expect(uploadUrl.searchParams.has("x-amz-checksum-crc32")).toBe(false);
    expect(uploadUrl.searchParams.has("x-amz-sdk-checksum-algorithm")).toBe(
      false,
    );
  });

  it("presigns remembrance uploads into the private remembrance prefix", async () => {
    stubS3Env();

    const upload = await createRemembrancePhotoUpload(
      "Family Portrait.png",
      "image/png",
      12345,
    );
    const uploadUrl = new URL(upload.uploadUrl);

    expect(upload.key).toMatch(
      /^remembrance\/[a-f0-9-]+-family-portrait\.png$/,
    );
    expect(uploadUrl.searchParams.get("X-Amz-SignedHeaders")).toBe("host");
    expect(uploadUrl.searchParams.has("x-amz-checksum-crc32")).toBe(false);
    expect(uploadUrl.searchParams.has("x-amz-sdk-checksum-algorithm")).toBe(
      false,
    );
  });

  it("uploads listing images into the marketplace listing prefix", async () => {
    stubS3Env();
    sendMock.mockResolvedValue({});

    const upload = await uploadMarketplaceListingImageObject(
      "Club Hoodie.png",
      "image/png",
      12_345,
      Uint8Array.from([1, 2, 3]),
    );

    expect(upload.key).toMatch(
      /^blarney\/listing\/[a-f0-9-]+-club-hoodie\.png$/,
    );
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][0]).toBeInstanceOf(PutObjectCommand);
    expect(sendMock.mock.calls[0][0].input).toMatchObject({
      Body: Uint8Array.from([1, 2, 3]),
      Bucket: "blarney-test",
      ContentType: "image/png",
      Key: upload.key,
    });
  });

  it("moves approved photos out of pending by copying then deleting the original key", async () => {
    stubS3Env();
    sendMock.mockResolvedValue({});

    await expect(
      movePendingPhotoToApproved("pending/four-stack.png"),
    ).resolves.toBe("approved/four-stack.png");

    expect(sendMock).toHaveBeenCalledTimes(2);
    expect(sendMock.mock.calls[0][0]).toBeInstanceOf(CopyObjectCommand);
    expect(sendMock.mock.calls[0][0].input).toMatchObject({
      Bucket: "blarney-test",
      CopySource: "blarney-test/pending/four-stack.png",
      Key: "approved/four-stack.png",
    });
    expect(sendMock.mock.calls[1][0]).toBeInstanceOf(DeleteObjectCommand);
    expect(sendMock.mock.calls[1][0].input).toMatchObject({
      Bucket: "blarney-test",
      Key: "pending/four-stack.png",
    });
  });

  it("moves approved photos back to their pending key", async () => {
    stubS3Env();
    sendMock.mockResolvedValue({});

    await expect(
      moveApprovedPhotoToPending(
        "approved/four-stack.png",
        "pending/four-stack.png",
      ),
    ).resolves.toBe("pending/four-stack.png");

    expect(sendMock).toHaveBeenCalledTimes(2);
    expect(sendMock.mock.calls[0][0]).toBeInstanceOf(CopyObjectCommand);
    expect(sendMock.mock.calls[0][0].input).toMatchObject({
      Bucket: "blarney-test",
      CopySource: "blarney-test/approved/four-stack.png",
      Key: "pending/four-stack.png",
    });
    expect(sendMock.mock.calls[1][0]).toBeInstanceOf(DeleteObjectCommand);
    expect(sendMock.mock.calls[1][0].input).toMatchObject({
      Bucket: "blarney-test",
      Key: "approved/four-stack.png",
    });
  });

  it("deletes a pending photo object without requiring a prior existence check", async () => {
    stubS3Env();
    sendMock.mockResolvedValue({});

    await expect(deletePhotoObject("pending/four-stack.png")).resolves.toBe(
      undefined,
    );

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][0]).toBeInstanceOf(DeleteObjectCommand);
    expect(sendMock.mock.calls[0][0].input).toMatchObject({
      Bucket: "blarney-test",
      Key: "pending/four-stack.png",
    });
  });

  it("reads photo bytes and content metadata for protected downloads", async () => {
    stubS3Env();
    sendMock.mockResolvedValue({
      Body: {
        transformToByteArray: vi
          .fn()
          .mockResolvedValue(Uint8Array.from([70, 79, 82, 69])),
      },
      ContentLength: 4,
      ContentType: "image/jpeg",
    });

    await expect(
      getPhotoObjectBytes("approved/four-stack.png"),
    ).resolves.toEqual({
      body: Buffer.from("FORE"),
      contentLength: 4,
      contentType: "image/jpeg",
    });

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][0]).toBeInstanceOf(GetObjectCommand);
    expect(sendMock.mock.calls[0][0].input).toMatchObject({
      Bucket: "blarney-test",
      Key: "approved/four-stack.png",
    });
  });
});
