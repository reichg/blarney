"use client";

import styles from "@/app/chair/chair.module.css";
import { filterChairListItems } from "@/app/chair/listFiltering";
import { RemembrancePhotoCard } from "@/app/chair/remembrance/RemembrancePhotoCard";
import {
  formatPaginationSummary,
  type PaginationState,
} from "@/lib/pagination";
import { useEffect, useMemo, useRef, useState } from "react";

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
  pagination?: PaginationState;
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
  pagination,
}: ChairRemembranceGalleryProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [filterValue, setFilterValue] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const selectAllRef = useRef<HTMLInputElement>(null);
  const searchItems = useMemo(
    () =>
      photos.map((photo) => ({
        id: photo.id,
        searchText: [
          photo.title,
          photo.caption ?? "N/A",
          photo.submitterEmail,
          photo.submitterName,
          photo.note ?? "N/A",
          photo.receivedAtLabel,
        ].join(" "),
        filters: [
          photo.caption ? "caption:yes" : "caption:no",
          photo.note ? "note:yes" : "note:no",
        ],
      })),
    [photos],
  );
  const filteredSearchItems = useMemo(
    () => filterChairListItems(searchItems, query, filterValue),
    [filterValue, query, searchItems],
  );
  const visiblePhotoIds = new Set(filteredSearchItems.map((item) => item.id));
  const filteredPhotos = photos.filter((photo) =>
    visiblePhotoIds.has(photo.id),
  );
  const photoIds = photos.map((photo) => photo.id);
  const shownPhotoIds = filteredPhotos.map((photo) => photo.id);
  const selectedPhotoIds = selectedIds.filter((id) => photoIds.includes(id));
  const visibleSelectedPhotoIds = selectedIds.filter((id) =>
    shownPhotoIds.includes(id),
  );
  const summary = pagination
    ? formatPaginationSummary(pagination)
    : `Showing ${filteredPhotos.length} of ${photos.length} remembrance photos on this page`;

  const allSelected =
    filteredPhotos.length > 0 &&
    visibleSelectedPhotoIds.length === filteredPhotos.length;
  const hasSelection = selectedPhotoIds.length > 0;
  const someSelected = visibleSelectedPhotoIds.length > 0 && !allSelected;

  useEffect(() => {
    if (!selectAllRef.current) {
      return;
    }

    selectAllRef.current.indeterminate = someSelected;
  }, [someSelected]);

  function togglePhotoSelection(id: string) {
    setSelectedIds((currentIds) =>
      currentIds.includes(id)
        ? currentIds.filter((currentId) => currentId !== id)
        : [...currentIds, id],
    );
  }

  function toggleSelectAll() {
    setSelectedIds((currentIds) => {
      const currentVisibleIds = currentIds.filter((id) =>
        shownPhotoIds.includes(id),
      );

      if (currentVisibleIds.length === filteredPhotos.length) {
        return currentIds.filter((id) => !shownPhotoIds.includes(id));
      }

      return [...new Set([...currentIds, ...shownPhotoIds])];
    });
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
        <div className={styles.listControls}>
          <label className={styles.listControlField}>
            <span>Search remembrance</span>
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search captions, names, emails, notes"
              type="search"
              value={query}
            />
          </label>
          <label className={styles.listControlField}>
            <span>Filter</span>
            <select
              onChange={(event) => setFilterValue(event.target.value)}
              value={filterValue}
            >
              <option value="">All remembrance photos</option>
              <option value="caption:yes">Has caption</option>
              <option value="caption:no">No caption</option>
              <option value="note:yes">Has note</option>
              <option value="note:no">No note</option>
            </select>
          </label>
          <p aria-live="polite" className={styles.listResultCount}>
            {summary}
          </p>
        </div>
        <div className={styles.selectionBar}>
          <div className={styles.selectionControls}>
            <label className={styles.selectionToggle}>
              <input
                aria-label={`Select all ${filteredPhotos.length} shown remembrance photos`}
                checked={allSelected}
                onChange={toggleSelectAll}
                ref={selectAllRef}
                type="checkbox"
              />
              <span>Select all shown</span>
            </label>
            <span className={styles.selectionSummary}>
              {selectedPhotoIds.length} selected on this page
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
        {filteredPhotos.length ? (
          filteredPhotos.map((photo) => {
            const isSelected = selectedPhotoIds.includes(photo.id);

            return (
              <RemembrancePhotoCard
                isSelected={isSelected}
                key={photo.id}
                onToggleSelect={togglePhotoSelection}
                photo={photo}
              />
            );
          })
        ) : (
          <article className={styles.panel}>
            <p className={styles.emptyState}>
              No remembrance photos match this search on the current page.
            </p>
          </article>
        )}
      </section>
    </>
  );
}
