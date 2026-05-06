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
  const captionId = useId();

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
        {photos.map((photo, index) => (
          <ModularCard as="figure" className={photoStyles.photo} key={photo.id}>
            <button
              aria-haspopup="dialog"
              aria-label={`Open photo ${index + 1} full size`}
              className={photoStyles.photoTrigger}
              onClick={(event) => openPhoto(index, event)}
              type="button"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt={photo.caption ?? "Blarney tournament photo"}
                src={`/api/photos/${photo.id}/view`}
              />
            </button>
            {photo.caption ? <figcaption>{photo.caption}</figcaption> : null}
          </ModularCard>
        ))}
      </div>

      {activePhoto ? (
        <div
          aria-describedby={activePhoto.caption ? captionId : undefined}
          aria-label="Approved photo"
          aria-modal="true"
          className={photoStyles.lightbox}
          onClick={closePhoto}
          role="dialog"
        >
          <div
            className={photoStyles.lightboxPanel}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              aria-label="Close full-size photo"
              className={photoStyles.lightboxClose}
              onClick={closePhoto}
              ref={closeButtonRef}
              type="button"
            >
              Close
            </button>
            <figure className={photoStyles.lightboxFigure}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt={activePhoto.caption ?? "Blarney tournament photo"}
                className={photoStyles.lightboxImage}
                src={`/api/photos/${activePhoto.id}/view`}
              />
              {activePhoto.caption ? (
                <figcaption
                  className={photoStyles.lightboxCaption}
                  id={captionId}
                >
                  {activePhoto.caption}
                </figcaption>
              ) : null}
            </figure>
          </div>
        </div>
      ) : null}
    </>
  );
}
