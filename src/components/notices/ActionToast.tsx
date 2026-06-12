"use client";

import styles from "@/components/notices/notices.module.css";
import type {
  ActionNotice,
  ActionToastValue,
} from "@/components/notices/type";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";

export type { ActionNotice } from "@/components/notices/type";

/** How long a success toast stays before auto-dismissing. Errors persist. */
const TOAST_AUTO_DISMISS_MS = 5000;

// Defaults to a no-op so consumers are safe to render outside a provider
// (e.g. in isolated unit tests) without throwing.
const ActionToastContext = createContext<ActionToastValue>({
  showToast: () => {},
});

export function useActionToast(): ActionToastValue {
  return useContext(ActionToastContext);
}

// Wraps a page tree so any action can surface a notice in the viewport
// regardless of scroll position. Errors no longer rely on top-of-page
// banners that scroll-preserving navigation keeps out of view.
export function ActionToastProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<ActionNotice | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearDismissTimer = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, []);

  const showToast = useCallback(
    (next: ActionNotice) => {
      clearDismissTimer();
      setNotice(next);

      // Success notices fade on their own; error notices persist until the
      // user dismisses them so failures are never missed.
      if (next.tone === "success") {
        dismissTimerRef.current = setTimeout(() => {
          setNotice(null);
          dismissTimerRef.current = null;
        }, TOAST_AUTO_DISMISS_MS);
      }
    },
    [clearDismissTimer],
  );

  const contextValue = useMemo<ActionToastValue>(
    () => ({ showToast }),
    [showToast],
  );

  useEffect(() => clearDismissTimer, [clearDismissTimer]);

  function handleDismiss() {
    clearDismissTimer();
    setNotice(null);
  }

  // Dismiss when the click lands on the backdrop itself, not the notice card.
  function handleBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      handleDismiss();
    }
  }

  return (
    <ActionToastContext.Provider value={contextValue}>
      {children}
      {notice ? (
        <div
          className={styles.actionToastViewport}
          onClick={handleBackdropClick}
        >
          <section
            className={`${styles.actionToast} ${
              notice.tone === "success"
                ? styles.actionToastSuccess
                : styles.actionToastError
            }`}
            role={notice.tone === "success" ? "status" : "alert"}
          >
            <div className={styles.actionToastCopy}>
              <p className={styles.actionToastTitle}>{notice.title}</p>
              {notice.body ? (
                <p className={styles.actionToastBody}>{notice.body}</p>
              ) : null}
            </div>
            <button
              aria-label="Dismiss notice"
              className={styles.actionToastDismiss}
              onClick={handleDismiss}
              type="button"
            >
              ×
            </button>
          </section>
        </div>
      ) : null}
    </ActionToastContext.Provider>
  );
}
