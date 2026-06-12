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
import {
  acceptedPhotoTypeLabel,
  uploadPhotoWithPresign,
} from "@/lib/photoUploadClient";
import { useUncontrolledFormDraft } from "@/lib/useFormDraft";
import { DraftNotice } from "@/components/DraftNotice";
import { useActionToast } from "@/components/notices/ActionToast";
import { useRouter } from "next/navigation";
import { type FormEvent, useRef, useState } from "react";

function getString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export function RemembranceForm() {
  const router = useRouter();
  const { showToast } = useActionToast();
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const { wasRestored, clearDraft, handleChange } = useUncontrolledFormDraft({
    formId: "remembrance",
    formVersion: 1,
    formRef,
  });

  // Toast copy stays static developer-authored text; nothing user- or
  // server-provided is interpolated into it.
  function failSubmit(title: string, body?: string) {
    showToast({ tone: "error", title, body });
    setStatus("");
    setIsSubmitting(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("Saving your remembrance...");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const message = getString(formData.get("message"));
    const name = getString(formData.get("name"));
    const email = getString(formData.get("email"));
    const photos = getSelectedPhotoFiles(formData);

    if (!message || !name || !email) {
      failSubmit(
        "Complete the remembrance message, name, and email before sending.",
      );
      return;
    }

    if (photos.some((photo) => !isAllowedImageType(photo.type))) {
      failSubmit(
        "One of the selected files is not a supported image.",
        `Use ${acceptedPhotoTypeLabel}, then try again.`,
      );
      return;
    }

    if (photos.some((photo) => !isAllowedPhotoSize(photo.size))) {
      failSubmit(
        "One of the selected photos is too large.",
        `Photos must be ${photoUploadLimitLabel} or smaller.`,
      );
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
        // The toast copy is static, so the response body is never surfaced.
        throw new Error("Remembrance could not be saved.");
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

      clearDraft();
      router.push("/remembrance/thanks");
    } catch (submissionError) {
      // Error detail goes to the console only; the toast copy stays static.
      console.error("remembrance submission failed", submissionError);
      failSubmit(
        "Your remembrance was not sent.",
        "Your entries are still in the form. Check your connection and try again.",
      );
    }
  }

  return (
    <form
      className={styles.form}
      onInput={handleChange}
      onSubmit={handleSubmit}
      ref={formRef}
    >
      <DraftNotice
        onDiscard={() => {
          clearDraft();
          formRef.current?.reset();
        }}
        visible={wasRestored}
      />
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
      <div aria-live="polite" className={styles.status}>
        {status}
      </div>
    </form>
  );
}
