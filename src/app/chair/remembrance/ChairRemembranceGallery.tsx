"use client";

import styles from "@/app/chair/chair.module.css";
import { useEffect, useRef, useState } from "react";

type RemembrancePhoto = {
  id: string;
  title: string;
  caption: string | null;
  submitterEmail: string;
  submitterName: string;
  notePreview: string | null;
  note: string | null;
  receivedAtLabel: string;
};

type ChairRemembranceGalleryProps = {
  photos: RemembrancePhoto[];
};

function getAttachmentFileName(contentDisposition: string | null) {
  if (!contentDisposition) {
    return "blarney-remembrance.zip";
  }

  const match = /filename="?([^";]+)"?/i.exec(contentDisposition);

  return match?.[1] ?? "blarney-remembrance.zip";
}

export function ChairRemembranceGallery({
  photos,
}: ChairRemembranceGalleryProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const selectAllRef = useRef<HTMLInputElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);
  const photoIds = photos.map((photo) => photo.id);
  const selectedPhotoIds = selectedIds.filter((id) => photoIds.includes(id));
  const activePhoto =
    activePhotoId === null
      ? null
      : (photos.find((photo) => photo.id === activePhotoId) ?? null);

  const allSelected =
    photos.length > 0 && selectedPhotoIds.length === photos.length;
  const hasSelection = selectedPhotoIds.length > 0;
  const someSelected = hasSelection && !allSelected;
  const activePhotoTitleId = activePhoto
    ? `chair-remembrance-title-${activePhoto.id}`
    : undefined;
  const activePhotoDescriptionId = activePhoto
    ? `chair-remembrance-description-${activePhoto.id}`
    : undefined;

  useEffect(() => {
    if (!selectAllRef.current) {
      return;
    }

    selectAllRef.current.indeterminate = someSelected;
  }, [someSelected]);

  useEffect(() => {
    if (!activePhoto) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setActivePhotoId(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      lastFocusedElementRef.current?.focus();
    };
  }, [activePhoto]);

  function togglePhotoSelection(id: string) {
    setSelectedIds((currentIds) =>
      currentIds.includes(id)
        ? currentIds.filter((currentId) => currentId !== id)
        : [...currentIds, id],
    );
  }

  function toggleSelectAll() {
    setSelectedIds((currentIds) =>
      currentIds.filter((id) => photoIds.includes(id)).length === photos.length
        ? []
        : photoIds,
    );
  }

  function openPhotoDetails(
    id: string,
    event: React.MouseEvent<HTMLButtonElement>,
  ) {
    lastFocusedElementRef.current = event.currentTarget;
    setActivePhotoId(id);
  }

  function closePhotoDetails() {
    setActivePhotoId(null);
  }

  async function downloadArchive(payload: { ids?: string[]; mode?: "all" }) {
    const response = await fetch("/api/chair/remembrance/download", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      throw new Error(body?.message ?? "Remembrance archive download failed.");
    }

    const blob = await response.blob();
    const fileName = getAttachmentFileName(
      response.headers.get("content-disposition"),
    );
    const objectUrl = URL.createObjectURL(blob);
    const downloadLink = document.createElement("a");

    downloadLink.href = objectUrl;
    downloadLink.download = fileName;
    document.body.append(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    URL.revokeObjectURL(objectUrl);
  }

  async function handleDownloadSelected() {
    if (!selectedPhotoIds.length) {
      return;
    }

    setErrorMessage("");
    setStatusMessage(
      `Preparing ${selectedPhotoIds.length} remembrance photo${selectedPhotoIds.length === 1 ? "" : "s"}...`,
    );
    setIsDownloading(true);

    try {
      await downloadArchive({ ids: selectedPhotoIds });
      setStatusMessage(
        `Download started for ${selectedPhotoIds.length} remembrance photo${selectedPhotoIds.length === 1 ? "" : "s"}.`,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Remembrance archive download failed.",
      );
      setStatusMessage("");
    } finally {
      setIsDownloading(false);
    }
  }

  async function handleDownloadAll() {
    setErrorMessage("");
    setStatusMessage("Preparing all remembrance photos...");
    setIsDownloading(true);

    try {
      await downloadArchive({ mode: "all" });
      setStatusMessage("Download started for all remembrance photos.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Remembrance archive download failed.",
      );
      setStatusMessage("");
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <>
      <section className={styles.panel}>
        <div className={styles.selectionBar}>
          <div className={styles.selectionControls}>
            <label className={styles.selectionToggle}>
              <input
                aria-label={`Select all ${photos.length} remembrance photos`}
                checked={allSelected}
                onChange={toggleSelectAll}
                ref={selectAllRef}
                type="checkbox"
              />
              <span>Select all on this page</span>
            </label>
            <span className={styles.selectionSummary}>
              {selectedPhotoIds.length} of {photos.length} on this page selected
            </span>
          </div>
          <div className={styles.downloadActions}>
            <button
              className={styles.secondaryActionButton}
              disabled={!hasSelection || isDownloading}
              onClick={handleDownloadSelected}
              type="button"
            >
              Download selected
            </button>
            <button
              className={styles.actionButton}
              disabled={isDownloading}
              onClick={handleDownloadAll}
              type="button"
            >
              Download all
            </button>
          </div>
        </div>
        <p
          aria-live="polite"
          className={`${styles.toolbarStatus} ${errorMessage ? styles.toolbarStatusError : ""}`}
        >
          {errorMessage || statusMessage}
        </p>
      </section>
      <section
        aria-busy={isDownloading}
        className={`${styles.photoGrid} ${styles.remembranceGrid}`}
      >
        {photos.map((photo) => {
          const isSelected = selectedPhotoIds.includes(photo.id);

          return (
            <article
              className={`${styles.panel} ${styles.remembranceCard}`}
              key={photo.id}
            >
              <div className={styles.remembranceCardHeader}>
                <label className={styles.selectionToggle}>
                  <input
                    aria-label={`Select ${photo.title}`}
                    checked={isSelected}
                    onChange={() => togglePhotoSelection(photo.id)}
                    type="checkbox"
                  />
                  <span>Select</span>
                </label>
                <span className={styles.muted}>{photo.receivedAtLabel}</span>
              </div>
              <button
                aria-haspopup="dialog"
                aria-label={`Open remembrance details for ${photo.title}`}
                className={styles.remembrancePreviewButton}
                onClick={(event) => openPhotoDetails(photo.id, event)}
                type="button"
              >
                <div className={styles.remembranceCardMedia}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt={photo.caption ?? "Remembrance photo preview"}
                    className={`${styles.photoPreview} ${styles.remembrancePhotoPreview}`}
                    src={`/api/chair/photos/${photo.id}/view`}
                  />
                </div>
                <div className={styles.remembranceCardBody}>
                  <div className={styles.remembranceCardCopy}>
                    <div className={styles.photoMeta}>
                      <p className={styles.muted}>{photo.submitterName}</p>
                    </div>
                  </div>
                </div>
              </button>
              <div
                className={`${styles.photoActionsRow} ${styles.remembranceCardActions}`}
              >
                <a
                  className={styles.secondaryActionButton}
                  href={`/api/chair/remembrance/${photo.id}/download`}
                >
                  Download photo
                </a>
              </div>
            </article>
          );
        })}
      </section>
      {activePhoto ? (
        <div
          aria-describedby={activePhotoDescriptionId}
          aria-labelledby={activePhotoTitleId}
          aria-modal="true"
          className={styles.remembranceDialog}
          onClick={closePhotoDetails}
          role="dialog"
        >
          <div
            className={styles.remembranceDialogPanel}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.remembranceDialogTopline}>
              <p className={styles.remembranceDialogEyebrow}>
                Private remembrance
              </p>
              <button
                className={`${styles.secondaryActionButton} ${styles.remembranceDialogClose}`}
                onClick={closePhotoDetails}
                ref={closeButtonRef}
                type="button"
              >
                Close
              </button>
            </div>
            <div className={styles.remembranceDialogBody}>
              <h2
                className={styles.remembranceDialogTitle}
                id={activePhotoTitleId}
              >
                {activePhoto.title}
              </h2>
              <div className={styles.remembranceDialogMeta}>
                <p>
                  <strong>Submitted by:</strong> {activePhoto.submitterName}
                </p>
                <p>
                  <strong>Email:</strong> {activePhoto.submitterEmail}
                </p>
                <p>
                  <strong>Received:</strong> {activePhoto.receivedAtLabel}
                </p>
              </div>
              <figure className={styles.remembranceDialogFigure}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={activePhoto.caption ?? "Remembrance photo preview"}
                  className={styles.remembranceDialogImage}
                  src={`/api/chair/photos/${activePhoto.id}/view`}
                />
              </figure>
              <div className={styles.remembranceDialogContent}>
                <div
                  className={styles.remembranceDialogCopy}
                  id={activePhotoDescriptionId}
                >
                  {activePhoto.note ? (
                    <div className={styles.remembranceDialogNote}>
                      <p>{activePhoto.note}</p>
                    </div>
                  ) : null}
                </div>
                <div className={styles.remembranceDialogActions}>
                  <a
                    className={styles.actionButton}
                    href={`/api/chair/remembrance/${activePhoto.id}/download`}
                  >
                    Download photo
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
