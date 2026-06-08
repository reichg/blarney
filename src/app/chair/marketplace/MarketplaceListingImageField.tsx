"use client";

import styles from "@/app/chair/chair.module.css";
import {
  acceptedPhotoContentTypes,
  photoUploadLimitLabel,
} from "@/lib/photoUpload";
import { useEffect, useRef, type ChangeEvent } from "react";

type MarketplaceListingImageFieldProps = {
  currentValue: string;
  errorMessage: string | null;
  fieldId: string;
  isSaving: boolean;
  onFileChange: (file: File | null) => void;
  onRemove: () => void;
  selectedFile: File | null;
  statusMessage: string;
  statusTone: "info" | "warning";
};

export function MarketplaceListingImageField({
  currentValue,
  errorMessage,
  fieldId,
  isSaving,
  onFileChange,
  onRemove,
  selectedFile,
  statusMessage,
  statusTone,
}: MarketplaceListingImageFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!selectedFile && fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [selectedFile]);

  function clearSelection() {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    onFileChange(event.target.files?.[0] ?? null);
  }

  return (
    <div className={styles.detailStack}>
      <label className={styles.listControlField} htmlFor={fieldId}>
        <span>Listing image</span>
        <input
          accept={acceptedPhotoContentTypes}
          id={fieldId}
          onChange={handleFileChange}
          ref={fileInputRef}
          type="file"
        />
      </label>
      {selectedFile || currentValue ? (
        <div className={styles.photoActionsRow}>
          <button
            className={styles.secondaryActionButton}
            disabled={isSaving}
            onClick={() => {
              clearSelection();
              onRemove();
            }}
            type="button"
          >
            {selectedFile ? "Clear selected image" : "Remove image"}
          </button>
        </div>
      ) : null}
      <p className={styles.sectionActionHint}>
        Choose a JPG, PNG, WebP, or GIF up to {photoUploadLimitLabel}. The file
        uploads when you save the listing.
      </p>
      <p
        aria-live="polite"
        className={[
          styles.toolbarStatus,
          errorMessage ? styles.toolbarStatusError : "",
          !errorMessage && statusTone === "warning"
            ? styles.marketplaceImageRemovalNotice
            : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {errorMessage ?? statusMessage}
      </p>
    </div>
  );
}
