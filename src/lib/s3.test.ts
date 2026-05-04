import { createPendingPhotoUpload } from "@/lib/s3";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("S3 photo uploads", () => {
  it("presigns browser PUT uploads without content length or empty checksums", async () => {
    vi.stubEnv("AWS_S3_BUCKET", "blarney-test");
    vi.stubEnv("AWS_REGION", "us-west-1");
    vi.stubEnv("AWS_ACCESS_KEY_ID", "test-access-key");
    vi.stubEnv("AWS_SECRET_ACCESS_KEY", "test-secret-key");

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
});
