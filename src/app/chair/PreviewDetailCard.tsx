"use client";

import styles from "@/app/chair/chair.module.css";
import { PreviewDetailCardCloseProvider } from "@/app/chair/PreviewDetailCardContext";
import type { PreviewDetailCardProps } from "@/app/chair/type";
import { useCallback, useEffect, useId, useRef, useState } from "react";

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
  const closeDialog = useCallback(() => setIsOpen(false), []);

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
            <div className={styles.detailDialogHeader}>
              <div className={styles.detailDialogTopline}>
                <p className={styles.detailDialogEyebrow}>{eyebrow}</p>
                <button
                  className={`${styles.secondaryActionButton} ${styles.detailDialogClose}`}
                  onClick={closeDialog}
                  ref={closeButtonRef}
                  type="button"
                >
                  Close
                </button>
              </div>
              <h2 className={styles.detailDialogTitle} id={titleId}>
                {title}
              </h2>
            </div>
            <div className={styles.detailDialogBody}>
              <div className={styles.detailDialogLayout}>
                <aside className={styles.detailDialogSummary}>
                  <p className={styles.detailDialogSectionEyebrow}>
                    At a glance
                  </p>
                  <div className={styles.detailDialogSummaryCard}>
                    {preview}
                  </div>
                </aside>
                <div className={styles.detailDialogContent}>
                  <p className={styles.detailDialogSectionEyebrow}>
                    Full details
                  </p>
                  <div className={styles.detailDialogContentPanel}>
                    <PreviewDetailCardCloseProvider value={closeDialog}>
                      {children}
                    </PreviewDetailCardCloseProvider>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}
