"use client";

import { ModularCard } from "@/components/ModularCard";
import { useEffect, useId, useRef, useState } from "react";
import photoStyles from "./photos.module.css";

type PhotoGalleryPhoto = {
  id: string;
  caption: string | null;
};

type PhotoGalleryProps = {
  photos: PhotoGalleryPhoto[];
};

export function PhotoGallery({ photos }: PhotoGalleryProps) {
  const [activePhotoIndex, setActivePhotoIndex] = useState<number | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);
  const lightboxTitleId = useId();
  const lightboxCaptionId = useId();

  const activePhoto =
    activePhotoIndex === null ? null : (photos[activePhotoIndex] ?? null);

  useEffect(() => {
    if (activePhotoIndex === null) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setActivePhotoIndex(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      lastFocusedElementRef.current?.focus();
    };
  }, [activePhotoIndex]);

  function openPhoto(
    index: number,
    event: React.MouseEvent<HTMLButtonElement>,
  ) {
    lastFocusedElementRef.current = event.currentTarget;
    setActivePhotoIndex(index);
  }

  function closePhoto() {
    setActivePhotoIndex(null);
  }

  return (
    <>
      <div className={photoStyles.gallery}>
        {photos.map((photo, index) => {
          const previewCaption = photo.caption ?? "Approved gallery photo";

          return (
            <ModularCard className={photoStyles.photo} key={photo.id}>
              <button
                aria-haspopup="dialog"
                aria-label={
                  photo.caption
                    ? `Open full-size photo: ${photo.caption}`
                    : `Open photo ${index + 1} full size`
                }
                className={photoStyles.photoTrigger}
                onClick={(event) => openPhoto(index, event)}
                type="button"
              >
                <span className={photoStyles.photoMedia}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt="Blarney tournament photo"
                    loading="lazy"
                    src={`/api/photos/${photo.id}/view`}
                  />
                </span>
                <span className={photoStyles.photoBody}>
                  <span className={photoStyles.photoKicker}>
                    Approved photo
                  </span>
                  <span
                    className={photoStyles.photoCaption}
                    title={previewCaption}
                  >
                    {previewCaption}
                  </span>
                  <span className={photoStyles.photoHint}>View full photo</span>
                </span>
              </button>
            </ModularCard>
          );
        })}
      </div>

      {activePhoto ? (
        <div
          aria-describedby={lightboxCaptionId}
          aria-labelledby={lightboxTitleId}
          aria-modal="true"
          className={photoStyles.lightbox}
          onClick={closePhoto}
          role="dialog"
        >
          <div
            className={photoStyles.lightboxPanel}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={photoStyles.lightboxTopline}>
              <p className={photoStyles.lightboxEyebrow}>Approved photo</p>
              <button
                aria-label="Close full-size photo"
                className={photoStyles.lightboxClose}
                onClick={closePhoto}
                ref={closeButtonRef}
                type="button"
              >
                Close
              </button>
            </div>
            <div className={photoStyles.lightboxBody}>
              <figure className={photoStyles.lightboxFigure}>
                <div className={photoStyles.lightboxMedia}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt="Blarney tournament photo"
                    className={photoStyles.lightboxImage}
                    src={`/api/photos/${activePhoto.id}/view`}
                  />
                </div>
              </figure>
              <section className={photoStyles.lightboxDetails}>
                <h2 className={photoStyles.lightboxTitle} id={lightboxTitleId}>
                  Blarney tournament photo
                </h2>
                <p className={photoStyles.lightboxDetailsLabel}>Caption</p>
                <p
                  className={photoStyles.lightboxCaption}
                  id={lightboxCaptionId}
                >
                  {activePhoto.caption ??
                    "No caption was provided for this gallery photo."}
                </p>
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
