"use client";

import styles from "@/app/forms.module.css";
import { useEffect, useState } from "react";

type CheckoutStatusResponse =
  | {
      ok: true;
      status: "confirmed";
      thanksPath: string;
    }
  | {
      ok: true;
      status: "processing";
      paymentPath: string;
    }
  | {
      ok: true;
      status: "review";
    }
  | {
      ok: false;
      status: "invalid" | "not_found";
    };

type RegistrationConfirmationPollerProps = {
  checkoutId: string;
  confirmedMessage?: string;
  missingMessage?: string;
  reviewMessage?: string;
  statusPath?: string;
  timeoutMessage?: string;
};

export function RegistrationConfirmationPoller({
  checkoutId,
  confirmedMessage = "Payment confirmed. Loading your registration summary...",
  missingMessage = "We could not find this checkout. Contact the chair if your payment receipt shows a completed charge.",
  reviewMessage = "Square may have completed this payment, but the registration needs chair review. Do not pay again if you have a Square receipt.",
  statusPath = `/api/register/checkout/${encodeURIComponent(checkoutId)}`,
  timeoutMessage = "Square has not sent confirmation yet. Do not pay again if you have a receipt; contact the chair with your payment receipt.",
}: RegistrationConfirmationPollerProps) {
  const [message, setMessage] = useState(
    "Waiting for Square to confirm your payment...",
  );

  useEffect(() => {
    let isActive = true;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;

    async function checkStatus() {
      attempts += 1;

      try {
        const response = await fetch(statusPath, { cache: "no-store" });
        const status = (await response.json()) as CheckoutStatusResponse;

        if (!isActive) {
          return;
        }

        if (status.ok && status.status === "confirmed") {
          setMessage(confirmedMessage);
          window.location.replace(status.thanksPath);
          return;
        }

        if (!status.ok) {
          setMessage(missingMessage);
          return;
        }

        if (status.status === "review") {
          setMessage(reviewMessage);
          return;
        }

        if (attempts >= 45) {
          setMessage(timeoutMessage);
          return;
        }

        timeoutId = setTimeout(checkStatus, 2000);
      } catch {
        if (!isActive) {
          return;
        }

        if (attempts >= 45) {
          setMessage(
            "Confirmation is taking longer than expected. Do not pay again if you have a receipt; contact the chair if this page does not update.",
          );
          return;
        }

        timeoutId = setTimeout(checkStatus, 3000);
      }
    }

    void checkStatus();

    return () => {
      isActive = false;

      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [
    confirmedMessage,
    missingMessage,
    reviewMessage,
    statusPath,
    timeoutMessage,
  ]);

  return (
    <div aria-live="polite" className={styles.summaryCard}>
      <h3>Confirmation</h3>
      <p className={styles.supportText}>{message}</p>
    </div>
  );
}
