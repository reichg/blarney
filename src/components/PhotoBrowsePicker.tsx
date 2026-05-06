"use client";

import styles from "@/components/PhotoBrowsePicker.module.css";
import { acceptedPhotoContentTypes } from "@/lib/photoUpload";
import { ChevronDown, FolderOpen, Images } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const folderPickerAttributes = {
  directory: "",
  webkitdirectory: "",
};

const defaultDescription =
  "Select one image, several images at once, or a folder when your browser supports folder selection.";

type PhotoBrowsePickerProps = {
  description?: string;
  disabled?: boolean;
  emptySelectionLabel?: string;
  helpTextId: string;
  inputName?: string;
  title?: string;
};

export function getSelectedPhotoFiles(formData: FormData, fieldName = "photo") {
  return formData
    .getAll(fieldName)
    .filter((value): value is File => value instanceof File && value.size > 0);
}

export function PhotoBrowsePicker({
  description = defaultDescription,
  disabled = false,
  emptySelectionLabel = "No photos selected yet",
  helpTextId,
  inputName = "photo",
  title = "Browse photos",
}: PhotoBrowsePickerProps) {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isBrowseMenuOpen, setIsBrowseMenuOpen] = useState(false);
  const [selectedPhotoCount, setSelectedPhotoCount] = useState(0);
  const isMenuVisible = isBrowseMenuOpen && !disabled;

  useEffect(() => {
    if (!isBrowseMenuOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsBrowseMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsBrowseMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isBrowseMenuOpen]);

  function updateSelectedPhotoCount() {
    const photoCount = photoInputRef.current?.files?.length ?? 0;
    const folderPhotoCount = folderInputRef.current?.files?.length ?? 0;

    setSelectedPhotoCount(photoCount + folderPhotoCount);
  }

  function browsePhotos() {
    setIsBrowseMenuOpen(false);
    photoInputRef.current?.click();
  }

  function browseFolder() {
    setIsBrowseMenuOpen(false);
    folderInputRef.current?.click();
  }

  return (
    <div className={styles.photoPicker}>
      <input
        accept={acceptedPhotoContentTypes}
        aria-describedby={helpTextId}
        className={styles.nativePicker}
        disabled={disabled}
        multiple={true}
        name={inputName}
        onChange={updateSelectedPhotoCount}
        ref={photoInputRef}
        type="file"
      />
      <input
        {...folderPickerAttributes}
        accept={acceptedPhotoContentTypes}
        aria-describedby={helpTextId}
        className={styles.nativePicker}
        disabled={disabled}
        multiple={true}
        name={inputName}
        onChange={updateSelectedPhotoCount}
        ref={folderInputRef}
        type="file"
      />
      <div className={styles.photoPickerBody}>
        <div className={styles.photoPickerCopy}>
          <strong>{title}</strong>
          <span>{description}</span>
        </div>
      </div>
      <div className={styles.browseMenuWrapper} ref={menuRef}>
        <button
          aria-describedby={helpTextId}
          aria-expanded={isMenuVisible}
          aria-haspopup="menu"
          className={styles.browseButton}
          disabled={disabled}
          onClick={() => setIsBrowseMenuOpen((isOpen) => !isOpen)}
          type="button"
        >
          <Images aria-hidden="true" size={18} />
          Browse
          <ChevronDown aria-hidden="true" size={16} />
        </button>
        {isMenuVisible ? (
          <div className={styles.browseMenu} role="menu">
            <button
              className={styles.browseMenuButton}
              onClick={browsePhotos}
              role="menuitem"
              type="button"
            >
              Photos
            </button>
            <button
              className={styles.browseMenuButton}
              onClick={browseFolder}
              role="menuitem"
              type="button"
            >
              Folder
            </button>
          </div>
        ) : null}
      </div>
      <p aria-live="polite" className={styles.selectionStatus}>
        {selectedPhotoCount > 0
          ? `${selectedPhotoCount} photo${selectedPhotoCount === 1 ? "" : "s"} selected`
          : emptySelectionLabel}
      </p>
    </div>
  );
}
