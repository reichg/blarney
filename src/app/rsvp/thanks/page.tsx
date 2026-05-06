import styles from "@/app/forms.module.css";
import { RegistrationConfirmationPoller } from "@/app/register/thanks/RegistrationConfirmationPoller";
import { db } from "@/lib/db";
import {
  getRsvpCheckoutPaymentPath,
  getRsvpPaymentBreakdown,
} from "@/lib/payment";
import { rsvpCheckoutPayloadSchema } from "@/lib/rsvpCheckout";
import { CreditCard } from "lucide-react";
import { redirect } from "next/navigation";

type RsvpThanksPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type RsvpStatusCard = {
  eyebrow: string;
  title: string;
  body: string;
  nextSteps: string[];
  note?: string;
  actionLabel?: string;
};

const configurationSignals = new Set([
  "CONFIG",
  "CONFIGURATION",
  "MISCONFIGURED",
]);

const unavailableSignals = new Set([
  "ERROR",
  "HANDOFF_UNAVAILABLE",
  "UNAVAILABLE",
]);

const incompleteSignals = new Set([
  "CANCELED",
  "CANCELLED",
  "FAILED",
  "INCOMPLETE",
  "INVALID",
]);

const reviewSignals = new Set([
  "DUPLICATE",
  "MANUAL_REVIEW",
  "PAYMENT_REVIEW",
  "REVIEW",
]);

const processingSignals = new Set(["PENDING", "PROCESSING"]);

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function firstParam(
  params: Record<string, string | string[] | undefined>,
  keys: string[],
) {
  for (const key of keys) {
    const value = firstValue(params[key]);

    if (value) {
      return value;
    }
  }

  return undefined;
}

function normalizeSignal(value: string | undefined) {
  return value
    ?.trim()
    .replaceAll(/[-\s]+/g, "_")
    .toUpperCase();
}

function isTruthyFlag(value: string | undefined) {
  if (!value) {
    return false;
  }

  return ["1", "TRUE", "YES"].includes(value.trim().toUpperCase());
}

function getPaymentSignal(
  params: Record<string, string | string[] | undefined>,
) {
  const explicitSignal = firstParam(params, [
    "payment",
    "paymentStatus",
    "status",
    "result",
    "confirmation",
  ]);

  if (explicitSignal) {
    return normalizeSignal(explicitSignal);
  }

  if (isTruthyFlag(firstParam(params, ["confirmed", "complete"]))) {
    return "CONFIRMED";
  }

  if (isTruthyFlag(firstParam(params, ["canceled", "cancelled"]))) {
    return "CANCELED";
  }

  return undefined;
}

function getOptionalRsvpPaymentBreakdown(attendeeCounts: {
  adultAttendeeCount: number;
  childAttendeeCount: number;
}) {
  try {
    return getRsvpPaymentBreakdown(attendeeCounts);
  } catch {
    return null;
  }
}

function getStatusCard({
  hasCheckoutLink,
  paymentSignal,
  rsvpFound,
}: {
  hasCheckoutLink: boolean;
  paymentSignal: string | undefined;
  rsvpFound: boolean;
}): RsvpStatusCard {
  if (rsvpFound) {
    return {
      eyebrow: "RSVP complete",
      title: "BBQ RSVP confirmed.",
      body: "Your BBQ RSVP and payment were received successfully.",
      nextSteps: [
        "You are on the BBQ list for the event.",
        "No further payment is needed for this RSVP.",
      ],
      note: "See you at the BBQ.",
    };
  }

  if (hasCheckoutLink && reviewSignals.has(paymentSignal ?? "")) {
    return {
      eyebrow: "Checkout status",
      title: "Chair review needed.",
      body: "Square may have completed this payment, but the BBQ RSVP could not be finalized automatically.",
      nextSteps: [
        "Do not pay again if you have a Square receipt.",
        "Contact the chair with your receipt so the payment can be matched to the correct RSVP.",
        "Keep this checkout link for reference until the chair marks the RSVP complete.",
      ],
    };
  }

  if (hasCheckoutLink && processingSignals.has(paymentSignal ?? "")) {
    return {
      eyebrow: "Checkout status",
      title: "Confirming payment.",
      body: "Payment is being confirmed. This page will update when Square sends the successful payment confirmation.",
      nextSteps: [
        "Keep this page open while confirmation finishes.",
        "Use the button below only if you have not completed payment yet.",
        "If you already have a Square receipt, do not pay again; contact the chair if this page does not update.",
      ],
      actionLabel: "Resume existing checkout",
    };
  }

  if (configurationSignals.has(paymentSignal ?? "")) {
    return {
      eyebrow: "Checkout status",
      title: "Payment setup unavailable.",
      body: "Payment checkout could not be prepared, so the BBQ RSVP was not finalized.",
      nextSteps: [
        "Please try the RSVP form again later.",
        "Contact the chair if payment setup still appears unavailable.",
      ],
    };
  }

  if (unavailableSignals.has(paymentSignal ?? "")) {
    return {
      eyebrow: "Checkout status",
      title: "Payment unavailable right now.",
      body: "Payment checkout could not be opened, so the BBQ RSVP was not finalized.",
      nextSteps: [
        "Please try the existing checkout link again later if you have not paid yet.",
        "If you already have a Square receipt, do not pay again; contact the chair with the receipt.",
      ],
    };
  }

  if (incompleteSignals.has(paymentSignal ?? "")) {
    return {
      eyebrow: "Checkout status",
      title: "Payment not confirmed.",
      body: "We could not confirm a completed payment from this link, so the BBQ RSVP was not finalized.",
      nextSteps: [
        hasCheckoutLink
          ? "Use the button below only if you have not completed payment yet."
          : "Return to the RSVP form to start checkout again.",
        "If you completed payment and still see this page, do not pay again; contact the chair with your receipt.",
      ],
      actionLabel: hasCheckoutLink ? "Resume existing checkout" : undefined,
    };
  }

  return {
    eyebrow: "RSVP status",
    title: "We couldn't confirm this RSVP.",
    body: "This link does not include a completed BBQ RSVP record, so we cannot show a confirmed RSVP here.",
    nextSteps: [
      hasCheckoutLink
        ? "Use the button below only if you have not completed payment yet."
        : "Return to the RSVP form if you still need to sign up.",
      "If you completed payment and still see this page, do not pay again; contact the chair with your receipt.",
    ],
    actionLabel: hasCheckoutLink ? "Resume existing checkout" : undefined,
  };
}

export default async function RsvpThanksPage({
  searchParams,
}: RsvpThanksPageProps) {
  const params = await searchParams;
  const rsvpId = firstValue(params.rsvp);
  const checkoutId = firstValue(params.rsvpCheckout);
  const checkout = checkoutId
    ? await db.rsvpCheckout
        .findUnique({
          where: { id: checkoutId },
          select: { payload: true, rsvpId: true, status: true },
        })
        .catch(() => null)
    : null;

  if (checkout?.rsvpId && !rsvpId) {
    redirect(
      `/rsvp/thanks?rsvp=${encodeURIComponent(checkout.rsvpId)}&payment=confirmed`,
    );
  }

  const rsvp = rsvpId
    ? await db.rsvp
        .findUnique({
          where: { id: rsvpId },
          select: {
            adultAttendeeCount: true,
            childAttendeeCount: true,
            attendeeCount: true,
            id: true,
          },
        })
        .catch(() => null)
    : null;
  const parsedCheckoutPayload = checkout?.payload
    ? rsvpCheckoutPayloadSchema.safeParse(checkout.payload)
    : null;
  const breakdown = rsvp
    ? getOptionalRsvpPaymentBreakdown({
        adultAttendeeCount: rsvp.adultAttendeeCount ?? 0,
        childAttendeeCount: rsvp.childAttendeeCount ?? 0,
      })
    : parsedCheckoutPayload?.success
      ? getOptionalRsvpPaymentBreakdown({
          adultAttendeeCount: parsedCheckoutPayload.data.adultAttendeeCount,
          childAttendeeCount: parsedCheckoutPayload.data.childAttendeeCount,
        })
      : null;
  const checkoutPaymentPath = checkoutId
    ? getRsvpCheckoutPaymentPath(checkoutId)
    : null;
  const paymentSignal =
    checkout?.status === "PAYMENT_REVIEW" ? "REVIEW" : getPaymentSignal(params);
  const statusCard = getStatusCard({
    hasCheckoutLink: Boolean(checkoutPaymentPath),
    paymentSignal,
    rsvpFound: Boolean(rsvp),
  });
  const paymentActionUrl =
    checkoutPaymentPath && statusCard.actionLabel
      ? checkoutPaymentPath
      : undefined;
  const showConfirmationPoller = Boolean(
    checkoutId && !rsvp && processingSignals.has(paymentSignal ?? ""),
  );
  const totalLabel = rsvp ? "Amount paid" : "Amount due";
  const attendeeSummary = rsvp
    ? `${rsvp.attendeeCount} attendee${rsvp.attendeeCount === 1 ? "" : "s"}`
    : parsedCheckoutPayload?.success
      ? `${parsedCheckoutPayload.data.adultAttendeeCount + parsedCheckoutPayload.data.childAttendeeCount} attendee${parsedCheckoutPayload.data.adultAttendeeCount + parsedCheckoutPayload.data.childAttendeeCount === 1 ? "" : "s"}`
      : null;

  return (
    <section className={styles.formSection}>
      <div className={styles.formShell}>
        <div className={styles.panel}>
          <p className="eyebrow">{statusCard.eyebrow}</p>
          <h1 className="section-title">{statusCard.title}</h1>
          <p>{statusCard.body}</p>
          {breakdown ? (
            <div className={styles.summaryCard}>
              <h3>BBQ RSVP summary</h3>
              <dl className={styles.summaryGrid}>
                {breakdown.lineItems.map((item) => (
                  <div key={item.label}>
                    <dt>{item.label}</dt>
                    <dd>
                      {item.quantity} x {item.unitPriceLabel}
                    </dd>
                  </div>
                ))}
                {attendeeSummary ? (
                  <div>
                    <dt>Party size</dt>
                    <dd>{attendeeSummary}</dd>
                  </div>
                ) : null}
                <div className={styles.summaryValue}>
                  <dt>{totalLabel}</dt>
                  <dd>{breakdown.totalLabel}</dd>
                </div>
              </dl>
            </div>
          ) : null}
          {statusCard.nextSteps.length ? (
            <div className={styles.summaryCard}>
              <h3>Next steps</h3>
              <ul className={styles.detailList}>
                {statusCard.nextSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {showConfirmationPoller && checkoutId ? (
            <RegistrationConfirmationPoller
              checkoutId={checkoutId}
              confirmedMessage="Payment confirmed. Loading your BBQ RSVP summary..."
              reviewMessage="Square may have completed this payment, but the BBQ RSVP needs chair review. Do not pay again if you have a Square receipt."
              statusPath={`/api/rsvp/checkout/${encodeURIComponent(checkoutId)}`}
            />
          ) : null}
          {paymentActionUrl ? (
            <a
              className={`primary-button ${styles.paymentAction}`}
              href={paymentActionUrl}
            >
              <CreditCard aria-hidden="true" size={18} />
              {statusCard.actionLabel}
            </a>
          ) : null}
          {statusCard.note ? <p>{statusCard.note}</p> : null}
        </div>
      </div>
    </section>
  );
}
