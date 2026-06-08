"use client";

import type { JSX } from "react";

import styles from "./DraftNotice.module.css";

const DEFAULT_MESSAGE = "We restored your unsaved entries from earlier.";

export type DraftNoticeProps = {
  visible: boolean;
  onDiscard?: () => void;
  onDismiss?: () => void;
  message?: string;
  className?: string;
};

export function DraftNotice({
  visible,
  onDiscard,
  onDismiss,
  message = DEFAULT_MESSAGE,
  className,
}: DraftNoticeProps): JSX.Element | null {
  if (!visible) {
    return null;
  }

  const rootClassName = className
    ? `${styles.notice} ${className}`
    : styles.notice;

  return (
    <div aria-live="polite" className={rootClassName} role="status">
      <span className={styles.message}>{message}</span>
      {(onDiscard || onDismiss) && (
        <div className={styles.actions}>
          {onDiscard && (
            <button
              className={styles.discardButton}
              onClick={onDiscard}
              type="button"
            >
              Start fresh
            </button>
          )}
          {onDismiss && (
            <button
              aria-label="Dismiss restored draft notice"
              className={styles.dismissButton}
              onClick={onDismiss}
              type="button"
            >
              <span aria-hidden="true">×</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
