"use client";

import formStyles from "@/app/forms.module.css";
import styles from "@/components/PhotoUploadForm.module.css";
import {
  acceptedPhotoContentTypes,
  isAllowedImageType,
  isAllowedPhotoSize,
  photoUploadLimitLabel,
} from "@/lib/photoUpload";
import { ChevronDown, FolderOpen, Images, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useRef, useState } from "react";

const acceptedPhotoTypeLabel = "JPEG, PNG, WebP, or GIF";

const folderPickerAttributes = {
  directory: "",
  webkitdirectory: "",
};

type PhotoUploadMetadata = {
  caption: string;
  submitterEmail: string;
  submitterName: string;
};

function getString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function getSelectedPhotos(formData: FormData) {
  return formData
    .getAll("photo")
    .filter((value): value is File => value instanceof File && value.size > 0);
}

async function uploadPhoto(photo: File, metadata: PhotoUploadMetadata) {
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

export function PhotoUploadForm() {
  const router = useRouter();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isBrowseMenuOpen, setIsBrowseMenuOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPhotoCount, setSelectedPhotoCount] = useState(0);

  function updateSelectedPhotoCount() {
    const photoCount = photoInputRef.current?.files?.length ?? 0;
    const folderPhotoCount = folderInputRef.current?.files?.length ?? 0;

    setSelectedPhotoCount(photoCount + folderPhotoCount);
  }

  function toggleBrowseMenu() {
    setIsBrowseMenuOpen((isOpen) => !isOpen);
  }

  function browsePhotos() {
    setIsBrowseMenuOpen(false);
    photoInputRef.current?.click();
  }

  function browseFolder() {
    setIsBrowseMenuOpen(false);
    folderInputRef.current?.click();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("Preparing upload...");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const photos = getSelectedPhotos(formData);

    if (photos.length === 0) {
      setError("Choose at least one photo to submit.");
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
        await uploadPhoto(photo, metadata);
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
        <textarea
          name="caption"
          placeholder="Describe the photo or set of photos."
          required
          rows={3}
        />
      </label>
      <fieldset className={formStyles.fieldset}>
        <legend>Photos</legend>
        <small className={formStyles.fieldHint} id="photo-upload-help">
          Use Browse to select one photo, multiple photos, or a folder. One
          caption applies to every selected photo. {acceptedPhotoTypeLabel};{" "}
          {photoUploadLimitLabel} max per photo.
        </small>
        <div className={styles.photoPicker}>
          <input
            accept={acceptedPhotoContentTypes}
            aria-describedby="photo-upload-help"
            className={styles.nativePicker}
            disabled={isSubmitting}
            multiple={true}
            name="photo"
            onChange={updateSelectedPhotoCount}
            ref={photoInputRef}
            type="file"
          />
          <input
            {...folderPickerAttributes}
            accept={acceptedPhotoContentTypes}
            aria-describedby="photo-upload-help"
            className={styles.nativePicker}
            disabled={isSubmitting}
            multiple={true}
            name="photo"
            onChange={updateSelectedPhotoCount}
            ref={folderInputRef}
            type="file"
          />
          <div className={styles.photoPickerBody}>
            <Images aria-hidden="true" size={24} />
            <div>
              <strong>Browse photos</strong>
              <span>
                Select one image, several images at once, or a folder when your
                browser supports folder selection.
              </span>
            </div>
          </div>
          <div className={styles.browseMenuWrapper}>
            <button
              aria-describedby="photo-upload-help"
              aria-expanded={isBrowseMenuOpen}
              aria-haspopup="menu"
              className={styles.browseButton}
              disabled={isSubmitting}
              onClick={toggleBrowseMenu}
              type="button"
            >
              <Images aria-hidden="true" size={18} />
              Browse
              <ChevronDown aria-hidden="true" size={16} />
            </button>
            {isBrowseMenuOpen ? (
              <div className={styles.browseMenu} role="menu">
                <button
                  className={styles.browseMenuButton}
                  onClick={browsePhotos}
                  role="menuitem"
                  type="button"
                >
                  <Images aria-hidden="true" size={18} />
                  Photos
                </button>
                <button
                  className={styles.browseMenuButton}
                  onClick={browseFolder}
                  role="menuitem"
                  type="button"
                >
                  <FolderOpen aria-hidden="true" size={18} />
                  Folder
                </button>
              </div>
            ) : null}
          </div>
          <p className={styles.selectionStatus} aria-live="polite">
            {selectedPhotoCount > 0
              ? `${selectedPhotoCount} photo${selectedPhotoCount === 1 ? "" : "s"} selected`
              : "No photos selected yet"}
          </p>
        </div>
      </fieldset>
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
