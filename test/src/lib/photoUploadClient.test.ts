import { uploadPhotoWithPresign } from "@/lib/photoUploadClient";
import { afterEach, describe, expect, it, vi } from "vitest";

// SHA-256 of the ASCII string "hello".
const helloSha256 =
  "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";

const metadata = {
  submitterName: "Pat",
  submitterEmail: "pat@example.com",
  caption: "On the green",
  purpose: "GALLERY",
} as const;

function createPhoto() {
  return new File(["hello"], "photo.jpg", { type: "image/jpeg" });
}

function stubSuccessfulFetch() {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ uploadUrl: "https://example.com/upload/photo" }),
    })
    .mockResolvedValueOnce({ ok: true });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function presignBody(fetchMock: ReturnType<typeof vi.fn>) {
  return JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<
    string,
    unknown
  >;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("uploadPhotoWithPresign", () => {
  it("sends the photo's SHA-256 lowercase hex contentHash to the presign route", async () => {
    const fetchMock = stubSuccessfulFetch();

    await uploadPhotoWithPresign(createPhoto(), metadata);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/photos/presign",
      expect.objectContaining({ method: "POST" }),
    );
    expect(presignBody(fetchMock)).toMatchObject({
      contentHash: helloSha256,
      contentType: "image/jpeg",
      fileName: "photo.jpg",
      fileSize: 5,
      purpose: "GALLERY",
      submitterEmail: "pat@example.com",
      submitterName: "Pat",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://example.com/upload/photo",
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("proceeds without a contentHash when crypto.subtle is unavailable", async () => {
    const fetchMock = stubSuccessfulFetch();
    vi.stubGlobal("crypto", {});

    await uploadPhotoWithPresign(createPhoto(), metadata);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(presignBody(fetchMock)).not.toHaveProperty("contentHash");
  });

  it("proceeds without a contentHash when hashing fails", async () => {
    const fetchMock = stubSuccessfulFetch();
    vi.stubGlobal("crypto", {
      subtle: {
        digest: vi.fn().mockRejectedValue(new Error("digest unavailable")),
      },
    });

    await uploadPhotoWithPresign(createPhoto(), metadata);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(presignBody(fetchMock)).not.toHaveProperty("contentHash");
  });
});
