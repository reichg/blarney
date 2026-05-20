"use client";

import formsStyles from "@/app/forms.module.css";
import { marketplaceCheckoutStatusResponseSchema } from "@/lib/marketplaceCheckout.contracts";
import { isTrustedSquareCheckoutUrl } from "@/lib/squareCheckoutUrl";
import {
  CircleCheckBig,
  Clock3,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "./checkout.module.css";

type MarketplaceCheckoutStatusProps = {
  checkoutId: string;
};

type ClientStatusState =
  | { kind: "loading" }
  | { kind: "pending"; paymentUrl: string }
  | { kind: "confirmed"; orderId: string }
  | { kind: "review" }
  | { kind: "expired" }
  | { kind: "not_found" }
  | { kind: "unavailable" };

export function MarketplaceCheckoutStatus({
  checkoutId,
}: MarketplaceCheckoutStatusProps) {
  const router = useRouter();
  const [state, setState] = useState<ClientStatusState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | undefined;

    async function loadStatus() {
      try {
        const response = await fetch(
          `/api/marketplace/checkout/${encodeURIComponent(checkoutId)}`,
          {
            cache: "no-store",
          },
        );
        const payload = await response.json().catch(() => null);
        const parsed =
          marketplaceCheckoutStatusResponseSchema.safeParse(payload);

        if (!parsed.success) {
          if (!cancelled) {
            setState({ kind: "unavailable" });
          }
          return;
        }

        const result = parsed.data;

        if (cancelled) {
          return;
        }

        if (result.ok && result.status === "confirmed") {
          setState({ kind: "confirmed", orderId: result.orderId });
          return;
        }

        if (result.ok && result.status === "pending") {
          setState({ kind: "pending", paymentUrl: result.paymentUrl });
          timeoutId = window.setTimeout(loadStatus, 2500);
          return;
        }

        if (!result.ok && result.status === "not_found") {
          setState({ kind: "not_found" });
          return;
        }

        if (result.status === "review") {
          setState({ kind: "review" });
          return;
        }

        if (result.status === "expired") {
          setState({ kind: "expired" });
          return;
        }

        setState({ kind: "unavailable" });
      } catch {
        if (!cancelled) {
          setState({ kind: "unavailable" });
        }
      }
    }

    void loadStatus();

    return () => {
      cancelled = true;

      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [checkoutId]);

  useEffect(() => {
    if (state.kind === "confirmed") {
      router.replace(
        `/marketplace/thanks?order=${encodeURIComponent(state.orderId)}`,
      );
    }
  }, [router, state]);

  function reopenPayment() {
    if (state.kind !== "pending") {
      return;
    }

    if (!isTrustedSquareCheckoutUrl(state.paymentUrl)) {
      setState({ kind: "unavailable" });
      return;
    }

    window.location.assign(state.paymentUrl);
  }

  if (state.kind === "loading") {
    return (
      <section className={`${formsStyles.panel} ${styles.statusPanel}`}>
        <div className={styles.statusHeader}>
          <LoaderCircle
            aria-hidden="true"
            className={styles.spinner}
            size={22}
          />
          <div>
            <p className={styles.statusEyebrow}>Checking payment</p>
            <h2>Waiting for the latest marketplace status</h2>
          </div>
        </div>
        <p className={formsStyles.supportText}>
          This page is syncing with the backend so it can confirm your payment
          state before showing a final result.
        </p>
      </section>
    );
  }

  if (state.kind === "confirmed") {
    return (
      <section className={`${formsStyles.panel} ${styles.statusPanel}`}>
        <div className={styles.statusHeader}>
          <CircleCheckBig
            aria-hidden="true"
            className={styles.successIcon}
            size={22}
          />
          <div>
            <p className={styles.statusEyebrow}>Order confirmed</p>
            <h2>Sending you to the marketplace confirmation page.</h2>
          </div>
        </div>
      </section>
    );
  }

  if (state.kind === "pending") {
    return (
      <section className={`${formsStyles.panel} ${styles.statusPanel}`}>
        <div className={styles.statusHeader}>
          <Clock3 aria-hidden="true" className={styles.pendingIcon} size={22} />
          <div>
            <p className={styles.statusEyebrow}>Payment still open</p>
            <h2>Your Square checkout is still active.</h2>
          </div>
        </div>
        <p className={formsStyles.supportText}>
          If you closed the payment page early or want to keep going, reopen the
          same secure checkout link below.
        </p>
        <div className={formsStyles.actionRow}>
          <button
            className={formsStyles.submitButton}
            onClick={reopenPayment}
            type="button"
          >
            <RefreshCw aria-hidden="true" size={18} />
            Reopen Square checkout
          </button>
          <Link className={formsStyles.secondaryAction} href="/marketplace">
            Back to marketplace
          </Link>
        </div>
      </section>
    );
  }

  if (state.kind === "review") {
    return (
      <section className={`${formsStyles.panel} ${styles.statusPanel}`}>
        <div className={styles.statusHeader}>
          <ShieldAlert
            aria-hidden="true"
            className={styles.reviewIcon}
            size={22}
          />
          <div>
            <p className={styles.statusEyebrow}>Manual review</p>
            <h2>Your payment needs a quick manual follow-up.</h2>
          </div>
        </div>
        <div className={formsStyles.notice}>
          The payment was received, but the backend flagged this order for
          review before showing a final confirmation. Please contact the chair
          if you need an update.
        </div>
        <div className={formsStyles.actionRow}>
          <Link className={formsStyles.secondaryAction} href="/marketplace">
            Back to marketplace
          </Link>
        </div>
      </section>
    );
  }

  if (state.kind === "expired") {
    return (
      <section className={`${formsStyles.panel} ${styles.statusPanel}`}>
        <div className={styles.statusHeader}>
          <ShieldAlert
            aria-hidden="true"
            className={styles.reviewIcon}
            size={22}
          />
          <div>
            <p className={styles.statusEyebrow}>Checkout expired</p>
            <h2>This marketplace checkout is no longer active.</h2>
          </div>
        </div>
        <p className={formsStyles.supportText}>
          Start a fresh checkout from the marketplace to create a new payment
          attempt.
        </p>
        <div className={formsStyles.actionRow}>
          <Link className={formsStyles.submitButton} href="/marketplace">
            Back to marketplace
          </Link>
        </div>
      </section>
    );
  }

  if (state.kind === "not_found") {
    return (
      <section className={`${formsStyles.panel} ${styles.statusPanel}`}>
        <div className={styles.statusHeader}>
          <ShieldAlert
            aria-hidden="true"
            className={styles.reviewIcon}
            size={22}
          />
          <div>
            <p className={styles.statusEyebrow}>Checkout not found</p>
            <h2>We could not find that marketplace checkout.</h2>
          </div>
        </div>
        <p className={formsStyles.supportText}>
          The checkout may have expired or the link may be incomplete.
        </p>
        <div className={formsStyles.actionRow}>
          <Link className={formsStyles.submitButton} href="/marketplace">
            Back to marketplace
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className={`${formsStyles.panel} ${styles.statusPanel}`}>
      <div className={styles.statusHeader}>
        <ShieldAlert
          aria-hidden="true"
          className={styles.reviewIcon}
          size={22}
        />
        <div>
          <p className={styles.statusEyebrow}>Temporarily unavailable</p>
          <h2>We could not finish checking your marketplace order.</h2>
        </div>
      </div>
      <p className={formsStyles.supportText}>
        Try refreshing this page in a moment, or head back to the marketplace if
        you want to start again.
      </p>
      <div className={formsStyles.actionRow}>
        <button
          className={formsStyles.secondaryAction}
          onClick={() => window.location.reload()}
          type="button"
        >
          Refresh status
        </button>
        <Link className={formsStyles.submitButton} href="/marketplace">
          Back to marketplace
        </Link>
      </div>
    </section>
  );
}
