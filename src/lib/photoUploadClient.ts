export type PhotoUploadRequest = {
  caption?: string;
  contentType: string;
  feedbackId?: string;
  fileName: string;
  fileSize: number;
  purpose?: "GALLERY" | "REMEMBRANCE";
  submitterEmail: string;
  submitterName: string;
};

export async function uploadPhotoWithPresign(
  photo: File,
  metadata: Omit<PhotoUploadRequest, "contentType" | "fileName" | "fileSize">,
) {
  const response = await fetch("/api/photos/presign", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fileName: photo.name,
      contentType: photo.type,
      fileSize: photo.size,
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
