"use client";

import { PreviewDetailCard } from "@/app/chair/PreviewDetailCard";
import styles from "@/app/chair/chair.module.css";

type RemembrancePhotoCardProps = {
  photo: {
    id: string;
    title: string;
    caption: string | null;
    submitterEmail: string;
    submitterName: string;
    note: string | null;
    receivedAtLabel: string;
  };
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
};

export function RemembrancePhotoCard({
  photo,
  isSelected,
  onToggleSelect,
}: RemembrancePhotoCardProps) {
  return (
    <PreviewDetailCard
      actions={
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
      }
      className={styles.remembrancePreviewCard}
      eyebrow="Private remembrance"
      header={
        <div className={styles.remembranceCardHeaderRow}>
          <label className={styles.selectionToggle}>
            <input
              aria-label={`Select ${photo.title}`}
              checked={isSelected}
              onChange={() => onToggleSelect(photo.id)}
              type="checkbox"
            />
            <span>Select</span>
          </label>
          <span className={styles.muted}>{photo.receivedAtLabel}</span>
        </div>
      }
      openLabel={`Open remembrance details for ${photo.title}`}
      preview={
        <>
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
              <h3 className={styles.remembranceCardTitle}>{photo.title}</h3>
              <div className={styles.photoMeta}>
                <p className={styles.muted}>{photo.submitterName}</p>
              </div>
            </div>
          </div>
        </>
      }
      title={photo.title}
    >
      <div className={styles.detailStack}>
        <div className={styles.remembranceDialogMeta}>
          <p>
            <strong>Submitted by:</strong> {photo.submitterName}
          </p>
          <p>
            <strong>Email:</strong> {photo.submitterEmail}
          </p>
          <p>
            <strong>Received:</strong> {photo.receivedAtLabel}
          </p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt={photo.caption ?? "Remembrance photo preview"}
          className={styles.detailImage}
          src={`/api/chair/photos/${photo.id}/view`}
        />
        <div className={styles.detailItem}>
          <span>Note</span>
          <p>{photo.note ?? "N/A"}</p>
        </div>
      </div>
    </PreviewDetailCard>
  );
}
