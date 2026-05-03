"use client";

import formStyles from "@/app/forms.module.css";
import styles from "@/components/PhotoUploadForm.module.css";
import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

const maxPhotoSize = 10 * 1024 * 1024;

function getString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export function PhotoUploadForm() {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("Preparing upload...");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const photo = formData.get("photo");

    if (!(photo instanceof File) || photo.size === 0) {
      setError("Choose a photo to submit.");
      setStatus("");
      setIsSubmitting(false);
      return;
    }

    if (photo.size > maxPhotoSize) {
      setError("Photos must be 10 MB or smaller.");
      setStatus("");
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch("/api/photos/presign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName: photo.name,
          contentType: photo.type,
          submitterName: getString(formData.get("submitterName")),
          submitterEmail: getString(formData.get("submitterEmail")),
          caption: getString(formData.get("caption")),
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(body?.message ?? "Photo upload could not be prepared.");
      }

      const { uploadUrl } = (await response.json()) as { uploadUrl: string };

      setStatus("Uploading photo...");

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

      router.push("/photos/thanks");
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Photo upload failed.",
      );
      setStatus("");
      setIsSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={formStyles.gridTwo}>
        <label className={formStyles.field}>
          <span>Name</span>
          <input name="submitterName" required type="text" />
        </label>
        <label className={formStyles.field}>
          <span>Email</span>
          <input name="submitterEmail" required type="email" />
        </label>
      </div>
      <label className={formStyles.field}>
        <span>Caption</span>
        <textarea name="caption" rows={3} />
      </label>
      <label className={formStyles.field}>
        <span>Photo</span>
        <input
          accept="image/jpeg,image/png,image/webp,image/gif"
          name="photo"
          required
          type="file"
        />
      </label>
      <button
        className={styles.uploadButton}
        disabled={isSubmitting}
        type="submit"
      >
        <Upload aria-hidden="true" size={18} />
        Submit for review
      </button>
      <div
        aria-live="polite"
        className={`${styles.status} ${error ? styles.error : ""}`}
      >
        {error || status}
      </div>
    </form>
  );
}
