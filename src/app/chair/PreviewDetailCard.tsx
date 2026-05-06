"use client";

import styles from "@/app/chair/chair.module.css";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

type PreviewDetailCardProps = {
  title: string;
  openLabel: string;
  eyebrow?: string;
  header?: ReactNode;
  preview: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function PreviewDetailCard({
  title,
  openLabel,
  eyebrow = "Details",
  header,
  preview,
  actions,
  children,
  className,
}: PreviewDetailCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const triggerElement = triggerRef.current;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
        return;
      }

      if (event.key !== "Tab" || !dialogPanelRef.current) {
        return;
      }

      const focusableElements = Array.from(
        dialogPanelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements.at(-1);

      if (!firstElement || !lastElement) {
        return;
      }

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
        return;
      }

      if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      triggerElement?.focus();
    };
  }, [isOpen]);

  return (
    <article className={`${styles.previewCard} ${className ?? ""}`}>
      {header ? <div className={styles.previewCardHeader}>{header}</div> : null}
      <button
        aria-haspopup="dialog"
        aria-label={openLabel}
        className={styles.previewCardButton}
        onClick={() => setIsOpen(true)}
        ref={triggerRef}
        type="button"
      >
        {preview}
        <span className={styles.previewCardHint}>View details</span>
      </button>
      {actions ? (
        <div className={styles.previewCardActions}>{actions}</div>
      ) : null}
      {isOpen ? (
        <div
          aria-labelledby={titleId}
          aria-modal="true"
          className={styles.detailDialog}
          onClick={() => setIsOpen(false)}
          role="dialog"
        >
          <div
            className={styles.detailDialogPanel}
            onClick={(event) => event.stopPropagation()}
            ref={dialogPanelRef}
          >
            <div className={styles.detailDialogTopline}>
              <p className={styles.detailDialogEyebrow}>{eyebrow}</p>
              <button
                className={`${styles.secondaryActionButton} ${styles.detailDialogClose}`}
                onClick={() => setIsOpen(false)}
                ref={closeButtonRef}
                type="button"
              >
                Close
              </button>
            </div>
            <div className={styles.detailDialogBody}>
              <h2 className={styles.detailDialogTitle} id={titleId}>
                {title}
              </h2>
              {children}
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}
