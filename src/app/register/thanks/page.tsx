import styles from "@/app/forms.module.css";
import { RegistrationConfirmationPoller } from "@/app/register/thanks/RegistrationConfirmationPoller";
import { db } from "@/lib/db";
import {
  getOptionalRegistrationPaymentBreakdown,
  getRegistrationCheckoutPaymentPath,
  hasSquarePaymentConfiguration,
  isCompleteRegistrationPaymentStatus,
} from "@/lib/payment";
import { registrationCheckoutPayloadSchema } from "@/lib/registrationCheckout";
import { reconcileRegistrationPayment } from "@/lib/registrationPayment";
import { CreditCard } from "lucide-react";
import { redirect } from "next/navigation";

type RegisterThanksPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type RegistrationStatusCard = {
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

function getStatusCard({
  hasCheckoutLink,
  paymentSignal,
  paymentStatus,
  registrationFound,
}: {
  hasCheckoutLink: boolean;
  paymentSignal: string | undefined;
  paymentStatus: string | undefined;
  registrationFound: boolean;
}): RegistrationStatusCard {
  if (!registrationFound) {
    if (hasCheckoutLink && reviewSignals.has(paymentSignal ?? "")) {
      return {
        eyebrow: "Checkout status",
        title: "Chair review needed.",
        body: "Square may have completed this payment, but the registration could not be finalized automatically.",
        nextSteps: [
          "Do not pay again if you have a Square receipt.",
          "Contact the chair with your receipt so the payment can be matched to the correct registration.",
          "Keep this checkout link for reference until the chair marks the registration complete.",
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
        body: "Payment checkout could not be prepared, so registration was not finalized.",
        nextSteps: [
          "Please try the registration form again later.",
          "Contact the chair if payment setup still appears unavailable.",
        ],
      };
    }

    if (unavailableSignals.has(paymentSignal ?? "")) {
      return {
        eyebrow: "Checkout status",
        title: "Payment unavailable right now.",
        body: "Payment checkout could not be opened, so registration was not finalized.",
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
        body: "We could not confirm a completed payment from this link, so registration was not finalized.",
        nextSteps: [
          hasCheckoutLink
            ? "Use the button below only if you have not completed payment yet."
            : "Return to the registration form to start checkout again.",
          "If you completed payment and still see this page, do not pay again; contact the chair with your receipt.",
        ],
        actionLabel: hasCheckoutLink ? "Resume existing checkout" : undefined,
      };
    }

    return {
      eyebrow: "Registration status",
      title: "We couldn't confirm this registration.",
      body: "This link does not include a completed registration record, so we cannot show a confirmed registration here.",
      nextSteps: [
        hasCheckoutLink
          ? "Use the button below only if you have not completed payment yet."
          : "Return to the registration form if you still need to sign up.",
        "If you completed payment and still see this page, do not pay again; contact the chair with your receipt.",
      ],
      actionLabel: hasCheckoutLink ? "Resume existing checkout" : undefined,
    };
  }

  if (isCompleteRegistrationPaymentStatus(paymentStatus ?? "")) {
    if (paymentStatus === "WAIVED") {
      return {
        eyebrow: "Registration complete",
        title: "No payment due.",
        body: "Your registration is complete. This registration was handled outside the online payment handoff, so no further payment is required here.",
        nextSteps: [
          "You do not need to reopen the payment page for this registration.",
          "Your registration is marked complete for the event chair.",
        ],
        note: "You are fully registered for the event.",
      };
    }

    return {
      eyebrow: "Registration complete",
      title: "Payment received.",
      body: "Your payment was received and your registration is complete.",
      nextSteps: [
        "You are fully registered for the event.",
        "No further payment is needed for this registration.",
      ],
      note: "Your registration is marked complete for the event chair.",
    };
  }

  if (!hasCheckoutLink && configurationSignals.has(paymentSignal ?? "")) {
    return {
      eyebrow: "Payment required",
      title: "Payment setup unavailable.",
      body: "This registration is not complete because payment has not been confirmed, and checkout is unavailable right now.",
      nextSteps: [
        "Please contact the chair before submitting the form again.",
        "The chair can help verify whether payment can be completed another way.",
      ],
      note: "Only completed registrations appear as confirmed.",
    };
  }

  if (!hasCheckoutLink && unavailableSignals.has(paymentSignal ?? "")) {
    return {
      eyebrow: "Payment required",
      title: "Payment unavailable right now.",
      body: "This registration is not complete because payment has not been confirmed, and checkout could not be opened.",
      nextSteps: [
        "Please contact the chair before submitting the form again.",
        "The chair can help verify whether payment can be completed another way.",
      ],
      note: "Only completed registrations appear as confirmed.",
    };
  }

  return {
    eyebrow: "Payment required",
    title: "Payment still required.",
    body: incompleteSignals.has(paymentSignal ?? "")
      ? "Payment did not finish for this registration. Complete payment to finalize it."
      : "This registration is not complete until payment succeeds.",
    nextSteps: [
      hasCheckoutLink
        ? "Use the button below only if you have not completed payment yet."
        : "Contact the chair if you already paid or need help completing payment.",
      "If you already have a Square receipt, do not pay again; contact the chair with your receipt.",
    ],
    note: "Only completed registrations appear as confirmed.",
    actionLabel: hasCheckoutLink ? "Resume existing checkout" : undefined,
  };
}

export default async function RegisterThanksPage({
  searchParams,
}: RegisterThanksPageProps) {
  const params = await searchParams;
  const registrationId = firstValue(params.registration);
  const checkoutId = firstValue(params.checkout);
  const checkout =
    checkoutId && !registrationId
      ? await db.registrationCheckout
          .findUnique({
            where: { id: checkoutId },
            select: { registrationId: true, status: true },
          })
          .catch(() => null)
      : null;

  if (checkout?.registrationId) {
    redirect(
      `/register/thanks?registration=${encodeURIComponent(
        checkout.registrationId,
      )}&payment=confirmed`,
    );
  }

  const rawRegistration = registrationId
    ? await db.registration
        .findUnique({
          where: { id: registrationId },
          include: {
            checkout: {
              select: {
                payload: true,
              },
            },
          },
        })
        .catch(() => null)
    : null;
  const isSquarePaymentConfigured = hasSquarePaymentConfiguration();
  const reconciledPayment =
    rawRegistration &&
    isSquarePaymentConfigured &&
    !isCompleteRegistrationPaymentStatus(rawRegistration.paymentStatus)
      ? await reconcileRegistrationPayment({
          id: rawRegistration.id,
          paymentStatus: rawRegistration.paymentStatus,
          paymentReference: rawRegistration.paymentReference,
        }).catch(() => null)
      : null;
  const registration = rawRegistration
    ? {
        ...rawRegistration,
        paymentStatus:
          reconciledPayment?.paymentStatus ?? rawRegistration.paymentStatus,
      }
    : null;
  const isRegistrationComplete = registration
    ? isCompleteRegistrationPaymentStatus(registration.paymentStatus)
    : false;
  const parsedRegistrationPayload = registration?.checkout
    ? registrationCheckoutPayloadSchema.safeParse(registration.checkout.payload)
    : null;
  const breakdown = registration
    ? getOptionalRegistrationPaymentBreakdown({
        golferCount: parsedRegistrationPayload?.success
          ? parsedRegistrationPayload.data.golfers.length
          : 1,
        bbqOnlyAdultCount: parsedRegistrationPayload?.success
          ? parsedRegistrationPayload.data.bbqOnlyAdultCount
          : registration.adultGuestCount,
        bbqOnlyKidCount: parsedRegistrationPayload?.success
          ? parsedRegistrationPayload.data.bbqOnlyKidCount
          : registration.childGuestCount,
      })
    : null;
  const checkoutPaymentPath = checkoutId
    ? getRegistrationCheckoutPaymentPath(checkoutId)
    : null;
  const paymentSignal =
    checkout?.status === "PAYMENT_REVIEW" ? "REVIEW" : getPaymentSignal(params);
  const statusCard = getStatusCard({
    hasCheckoutLink: Boolean(checkoutPaymentPath),
    paymentSignal,
    paymentStatus: registration?.paymentStatus,
    registrationFound: Boolean(registration),
  });
  const summaryHeading =
    registration?.paymentStatus === "WAIVED" || isRegistrationComplete
      ? "Registration summary"
      : "Payment summary";
  const totalLabel =
    registration?.paymentStatus === "WAIVED"
      ? "Standard amount"
      : isRegistrationComplete
        ? "Amount paid"
        : "Amount due";
  const paymentActionUrl =
    checkoutPaymentPath && statusCard.actionLabel
      ? checkoutPaymentPath
      : undefined;
  const showConfirmationPoller = Boolean(
    checkoutId && !registration && processingSignals.has(paymentSignal ?? ""),
  );

  return (
    <section className={styles.formSection}>
      <div className={styles.formShell}>
        <div className={styles.panel}>
          <p className="eyebrow">{statusCard.eyebrow}</p>
          <h1 className="section-title">{statusCard.title}</h1>
          <p>{statusCard.body}</p>
          {breakdown ? (
            <div className={styles.summaryCard}>
              <h3>{summaryHeading}</h3>
              <dl className={styles.summaryGrid}>
                {breakdown.lineItems.map((item) => (
                  <div key={item.label}>
                    <dt>{item.label}</dt>
                    <dd>
                      {item.quantity} x {item.unitPriceLabel}
                    </dd>
                  </div>
                ))}
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
            <RegistrationConfirmationPoller checkoutId={checkoutId} />
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
