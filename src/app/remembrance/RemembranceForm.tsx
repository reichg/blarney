"use client";

import formStyles from "@/app/forms.module.css";
import styles from "@/app/remembrance/remembrance.module.css";
import {
  PhotoBrowsePicker,
  getSelectedPhotoFiles,
} from "@/components/PhotoBrowsePicker";
import {
  isAllowedImageType,
  isAllowedPhotoSize,
  photoUploadLimitLabel,
} from "@/lib/photoUpload";
import { uploadPhotoWithPresign } from "@/lib/photoUploadClient";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

const acceptedPhotoTypeLabel = "JPEG, PNG, WebP, or GIF";

function getString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export function RemembranceForm() {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("Saving your remembrance...");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const message = getString(formData.get("message"));
    const name = getString(formData.get("name"));
    const email = getString(formData.get("email"));
    const photos = getSelectedPhotoFiles(formData);

    if (!message || !name || !email) {
      setError(
        "Complete the remembrance message, name, and email before sending.",
      );
      setStatus("");
      setIsSubmitting(false);
      return;
    }

    const unsupportedPhoto = photos.find(
      (photo) => !isAllowedImageType(photo.type),
    );

    if (unsupportedPhoto) {
      setError(
        `${unsupportedPhoto.name} is not a supported image. Use ${acceptedPhotoTypeLabel}.`,
      );
      setStatus("");
      setIsSubmitting(false);
      return;
    }

    const oversizedPhoto = photos.find(
      (photo) => !isAllowedPhotoSize(photo.size),
    );

    if (oversizedPhoto) {
      setError(
        `${oversizedPhoto.name} is too large. Photos must be ${photoUploadLimitLabel} or smaller.`,
      );
      setStatus("");
      setIsSubmitting(false);
      return;
    }

    try {
      const remembranceResponse = await fetch("/api/remembrance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          name: name || undefined,
          email: email || undefined,
        }),
      });

      if (!remembranceResponse.ok) {
        const body = (await remembranceResponse.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(body?.message ?? "Remembrance could not be saved.");
      }

      const { feedbackId } = (await remembranceResponse.json()) as {
        feedbackId: string;
      };

      for (const [index, photo] of photos.entries()) {
        const photoNumber = index + 1;
        setStatus(
          `Uploading ${photoNumber} of ${photos.length}: ${photo.name}`,
        );
        await uploadPhotoWithPresign(photo, {
          submitterName: name,
          submitterEmail: email,
          purpose: "REMEMBRANCE",
          feedbackId,
        });
      }

      router.push("/remembrance/thanks");
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Remembrance could not be sent.",
      );
      setStatus("");
      setIsSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <label className={`${formStyles.field} ${styles.messageField}`}>
        <span className={formStyles.requiredLabel}>Remembrance message</span>
        <textarea
          name="message"
          placeholder="Share a memory, a name you want honored, or a note for the chair to keep with this year's remembrance."
          required
          rows={7}
        />
      </label>
      <div className={styles.contactBlock}>
        <p className={styles.supportNote}>
          Name and email are required so the chair can follow up if needed.
          Photos are optional.
        </p>
        <div className={formStyles.gridTwo}>
          <label className={formStyles.field}>
            <span className={formStyles.requiredLabel}>Name</span>
            <input name="name" required type="text" />
          </label>
          <label className={formStyles.field}>
            <span className={formStyles.requiredLabel}>Email</span>
            <input name="email" required type="email" />
          </label>
        </div>
      </div>
      <fieldset className={formStyles.fieldset}>
        <legend>Optional photos</legend>
        <small className={formStyles.fieldHint} id="remembrance-photo-help">
          Add photos if they help tell the story. These uploads stay out of the
          public gallery and go to chair review only. {acceptedPhotoTypeLabel};{" "}
          {photoUploadLimitLabel} max per photo.
        </small>
        <PhotoBrowsePicker
          disabled={isSubmitting}
          helpTextId="remembrance-photo-help"
          title="Browse remembrance photos"
        />
      </fieldset>
      <button
        className={formStyles.submitButton}
        disabled={isSubmitting}
        type="submit"
      >
        Send remembrance
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
