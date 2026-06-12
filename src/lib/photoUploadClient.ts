import type { PhotoUploadRequest } from "@/lib/type";

export type { PhotoUploadRequest } from "@/lib/type";

/** User-facing label for the accepted photo content types in photoUpload.ts. */
export const acceptedPhotoTypeLabel = "JPEG, PNG, WebP, or GIF";

// Best-effort duplicate detection: returns undefined when hashing is
// unavailable or fails so the upload itself is never blocked.
async function computeContentHash(photo: File): Promise<string | undefined> {
  try {
    if (!globalThis.crypto?.subtle) {
      return undefined;
    }
    const digest = await crypto.subtle.digest(
      "SHA-256",
      await photo.arrayBuffer(),
    );
    return Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
  } catch {
    return undefined;
  }
}

export async function uploadPhotoWithPresign(
  photo: File,
  metadata: Omit<PhotoUploadRequest, "contentType" | "fileName" | "fileSize">,
) {
  const contentHash = await computeContentHash(photo);
  const response = await fetch("/api/photos/presign", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fileName: photo.name,
      contentType: photo.type,
      fileSize: photo.size,
      contentHash,
      submitterName: metadata.submitterName,
      submitterEmail: metadata.submitterEmail,
      caption: metadata.caption,
      purpose: metadata.purpose,
      feedbackId: metadata.feedbackId,
    }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(body?.message ?? "Photo upload could not be prepared.");
  }

  const { uploadUrl } = (await response.json()) as { uploadUrl: string };
  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": photo.type,
    },
    body: photo,
  });

  if (!uploadResponse.ok) {
    throw new Error("Photo upload failed before review.");
  }
}
