"use client";

import styles from "@/app/chair/chair.module.css";
import { getAttachmentFileName } from "@/app/chair/download";
import { filterChairListItems } from "@/app/chair/listFiltering";
import { useChairActionToast } from "@/app/chair/notices/ChairActionToast";
import { RemembrancePhotoCard } from "@/app/chair/remembrance/RemembrancePhotoCard";
import { type ChairRemembranceGalleryProps } from "@/app/chair/remembrance/type";
import { formatPaginationSummary } from "@/lib/pagination";
import { useEffect, useMemo, useRef, useState } from "react";

const remembranceArchiveFileName = "blarney-remembrance.zip";

export function ChairRemembranceGallery({
  photos,
  pagination,
}: ChairRemembranceGalleryProps) {
  const { showToast } = useChairActionToast();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [filterValue, setFilterValue] = useState("");
  const [downloadingAction, setDownloadingAction] = useState<
    "selected" | "all" | null
  >(null);
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

  const isDownloading = downloadingAction !== null;
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
      throw new Error("Remembrance archive download failed.");
    }

    const blob = await response.blob();
    const fileName = getAttachmentFileName(
      response.headers.get("content-disposition"),
      remembranceArchiveFileName,
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

    setDownloadingAction("selected");

    try {
      await downloadArchive({ ids: selectedPhotoIds });
      showToast({
        tone: "success",
        title: "Download started",
        body: `ZIP of ${selectedPhotoIds.length} remembrance photo${selectedPhotoIds.length === 1 ? "" : "s"} is downloading.`,
      });
    } catch {
      showToast({
        tone: "error",
        title: "Remembrance download failed",
        body: "Try again.",
      });
    } finally {
      setDownloadingAction(null);
    }
  }

  async function handleDownloadAll() {
    setDownloadingAction("all");

    try {
      await downloadArchive({ mode: "all" });
      showToast({
        tone: "success",
        title: "Download started",
        body: "ZIP of all remembrance photos is downloading.",
      });
    } catch {
      showToast({
        tone: "error",
        title: "Remembrance download failed",
        body: "Try again.",
      });
    } finally {
      setDownloadingAction(null);
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
              {downloadingAction === "selected"
                ? "Preparing…"
                : "Download selected"}
            </button>
            <button
              className={styles.actionButton}
              disabled={isDownloading}
              onClick={handleDownloadAll}
              type="button"
            >
              {downloadingAction === "all" ? "Preparing…" : "Download all"}
            </button>
          </div>
        </div>
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
