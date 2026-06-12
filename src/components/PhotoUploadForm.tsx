"use client";

import formStyles from "@/app/forms.module.css";
import {
  PhotoBrowsePicker,
  getSelectedPhotoFiles,
} from "@/components/PhotoBrowsePicker";
import styles from "@/components/PhotoUploadForm.module.css";
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
import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useRef, useState } from "react";

function getString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export function PhotoUploadForm() {
  const router = useRouter();
  const { showToast } = useActionToast();
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const { wasRestored, clearDraft, handleChange } = useUncontrolledFormDraft({
    formId: "photoUpload",
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
    setStatus("Preparing upload...");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const photos = getSelectedPhotoFiles(formData);

    if (photos.length === 0) {
      failSubmit("Choose at least one photo to submit.");
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
      const metadata = {
        submitterName: getString(formData.get("submitterName")),
        submitterEmail: getString(formData.get("submitterEmail")),
        caption: getString(formData.get("caption")),
      };

      for (const [index, photo] of photos.entries()) {
        const photoNumber = index + 1;
        setStatus(
          `Uploading ${photoNumber} of ${photos.length}: ${photo.name}`,
        );
        await uploadPhotoWithPresign(photo, metadata);
      }

      clearDraft();
      router.push("/photos/thanks");
    } catch (uploadError) {
      // Error detail goes to the console only; the toast copy stays static.
      console.error("photo upload failed", uploadError);
      failSubmit(
        "Photo upload did not finish.",
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
      <p className={styles.formIntro}>
        Add your contact info, an optional caption for the selected set, and the
        photos you want reviewed.
      </p>
      <div className={`${formStyles.gridTwo} ${styles.contactFields}`}>
        <label className={formStyles.field}>
          <span className={formStyles.requiredLabel}>Name</span>
          <input name="submitterName" required type="text" />
        </label>
        <label className={formStyles.field}>
          <span className={formStyles.requiredLabel}>Email</span>
          <input name="submitterEmail" required type="email" />
        </label>
      </div>
      <div className={styles.detailsGrid}>
        <label className={`${formStyles.field} ${styles.captionField}`}>
          <span>Caption (optional)</span>
          <textarea
            name="caption"
            placeholder="Describe the photo or set of photos."
            rows={4}
          />
        </label>
        <fieldset className={`${formStyles.fieldset} ${styles.photoFieldset}`}>
          <legend className={formStyles.requiredLabel}>Photos</legend>
          <div className={styles.photoFieldsetBody}>
            <small className={formStyles.fieldHint} id="photo-upload-help">
              Choose at least one photo. One caption applies to every selected
              photo. {acceptedPhotoTypeLabel}; {photoUploadLimitLabel} max per
              photo.
            </small>
            <PhotoBrowsePicker
              description="Select one photo, several photos, or a folder."
              disabled={isSubmitting}
              helpTextId="photo-upload-help"
              title="Choose photos"
            />
          </div>
        </fieldset>
      </div>
      <div className={styles.formFooter}>
        <div aria-live="polite" className={styles.status}>
          {status}
        </div>
        <button
          className={styles.uploadButton}
          disabled={isSubmitting}
          type="submit"
        >
          <Upload aria-hidden="true" size={18} />
          Submit for review
        </button>
      </div>
    </form>
  );
}
