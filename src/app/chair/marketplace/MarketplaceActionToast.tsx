"use client";

import styles from "@/app/chair/chair.module.css";
import type { MarketplaceNotice } from "@/app/chair/marketplace/marketplaceNotices";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";

/** How long an action toast stays before auto-dismissing. */
const TOAST_AUTO_DISMISS_MS = 5000;

type ShowMarketplaceToast = (notice: MarketplaceNotice) => void;

// Defaults to a no-op so the navigation hook is safe to call outside a provider
// (e.g. in isolated unit tests) without throwing.
const MarketplaceToastContext = createContext<ShowMarketplaceToast>(() => {});

export function useMarketplaceToast(): ShowMarketplaceToast {
  return useContext(MarketplaceToastContext);
}

// Wraps the chair marketplace tree so any action form can surface a notice in
// the viewport regardless of scroll position. Errors no longer rely on the
// top-of-page banner that scroll-preserving navigation kept out of view.
export function MarketplaceActionToastProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [notice, setNotice] = useState<MarketplaceNotice | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearDismissTimer = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, []);

  const showToast = useCallback<ShowMarketplaceToast>(
    (next) => {
      clearDismissTimer();
      setNotice(next);
      dismissTimerRef.current = setTimeout(() => {
        setNotice(null);
        dismissTimerRef.current = null;
      }, TOAST_AUTO_DISMISS_MS);
    },
    [clearDismissTimer],
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
    <MarketplaceToastContext.Provider value={showToast}>
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
              <p className={styles.actionToastBody}>{notice.body}</p>
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
    </MarketplaceToastContext.Provider>
  );
}
