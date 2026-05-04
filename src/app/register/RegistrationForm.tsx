"use client";

import type { SubmitRegistrationResult } from "@/app/actions/registration";
import styles from "@/app/forms.module.css";
import { CreditCard, Flag } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

const checkoutStorageKey = "blarney.registrationCheckout";

type RegistrationFormProps = {
  currency: string;
  defaultPackageSelection: string;
  golfPriceCents: number | null;
  golfPriceLabel: string | null;
  adultGuestPriceCents: number | null;
  adultGuestPriceLabel: string | null;
  childGuestPriceCents: number | null;
  childGuestPriceLabel: string | null;
  submitAction: (formData: FormData) => Promise<SubmitRegistrationResult>;
};

type SummaryItem = {
  label: string;
  quantity: number;
  unitPriceLabel: string;
};

type PendingCheckoutResume = {
  checkoutId: string;
  paymentPath: string;
  thanksPath: string;
};

function formatCurrency(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export function RegistrationForm({
  currency,
  defaultPackageSelection,
  golfPriceCents,
  golfPriceLabel,
  adultGuestPriceCents,
  adultGuestPriceLabel,
  childGuestPriceCents,
  childGuestPriceLabel,
  submitAction,
}: RegistrationFormProps) {
  const [adultGuestCount, setAdultGuestCount] = useState(0);
  const [childGuestCount, setChildGuestCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingCheckout, setPendingCheckout] =
    useState<PendingCheckoutResume | null>(null);
  const totalCents =
    golfPriceCents === null ||
    adultGuestPriceCents === null ||
    childGuestPriceCents === null
      ? null
      : golfPriceCents +
        adultGuestCount * adultGuestPriceCents +
        childGuestCount * childGuestPriceCents;
  const totalLabel =
    totalCents === null ? null : formatCurrency(totalCents, currency);
  const summaryItems: SummaryItem[] = [];

  if (golfPriceLabel) {
    summaryItems.push({
      label: "Golf entry",
      quantity: 1,
      unitPriceLabel: golfPriceLabel,
    });
  }

  if (adultGuestPriceLabel && adultGuestCount > 0) {
    summaryItems.push({
      label: "Pre-event adults",
      quantity: adultGuestCount,
      unitPriceLabel: adultGuestPriceLabel,
    });
  }

  if (childGuestPriceLabel && childGuestCount > 0) {
    summaryItems.push({
      label: "Pre-event children",
      quantity: childGuestCount,
      unitPriceLabel: childGuestPriceLabel,
    });
  }

  useEffect(() => {
    try {
      const storedCheckout = window.sessionStorage.getItem(checkoutStorageKey);

      if (!storedCheckout) {
        return;
      }

      const parsed = JSON.parse(storedCheckout) as PendingCheckoutResume;

      if (parsed.checkoutId && parsed.paymentPath && parsed.thanksPath) {
        queueMicrotask(() => {
          setPendingCheckout(parsed);
        });
      }
    } catch {
      window.sessionStorage.removeItem(checkoutStorageKey);
    }
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const form = event.currentTarget;
    const formData = new FormData(form);

    void (async () => {
      try {
        const result = await submitAction(formData);

        if (!result.ok) {
          setError(result.error);
          setIsSubmitting(false);
          return;
        }

        if (result.alreadyConfirmed) {
          try {
            window.sessionStorage.removeItem(checkoutStorageKey);
          } catch {
            // Session storage can be unavailable; confirmation still works.
          }
        } else {
          const nextCheckout = {
            checkoutId: result.checkoutId,
            paymentPath: result.paymentPath,
            thanksPath: result.thanksPath,
          };

          setPendingCheckout(nextCheckout);

          try {
            window.sessionStorage.setItem(
              checkoutStorageKey,
              JSON.stringify(nextCheckout),
            );
          } catch {
            // Session storage can be unavailable; the app URL still resumes.
          }
        }

        window.location.assign(
          result.alreadyConfirmed ? result.checkoutUrl : result.paymentPath,
        );
      } catch {
        setError("Registration could not be submitted. Please try again.");
        setIsSubmitting(false);
      }
    })();
  }

  return (
    <form
      aria-busy={isSubmitting}
      className={`${styles.panel} ${styles.form}`}
      onSubmit={handleSubmit}
    >
      {pendingCheckout ? (
        <section className={styles.summaryCard}>
          <h3>Checkout in progress</h3>
          <p className={styles.supportText}>
            Resume the existing Square checkout if payment is not complete. If
            you already have a Square receipt, check confirmation instead of
            paying again.
          </p>
          <div className={styles.actionRow}>
            <a className="primary-button" href={pendingCheckout.paymentPath}>
              <CreditCard aria-hidden="true" size={18} /> Resume checkout
            </a>
            <a
              className={styles.secondaryAction}
              href={pendingCheckout.thanksPath}
            >
              Check confirmation
            </a>
          </div>
        </section>
      ) : null}
      <div className={styles.gridTwo}>
        <label className={styles.field}>
          <span>First name</span>
          <input name="firstName" required type="text" />
        </label>
        <label className={styles.field}>
          <span>Last name</span>
          <input name="lastName" required type="text" />
        </label>
      </div>
      <div className={styles.gridTwo}>
        <label className={styles.field}>
          <span>Email</span>
          <input name="email" required type="email" />
        </label>
        <label className={styles.field}>
          <span>Phone</span>
          <input name="phone" required type="tel" />
        </label>
      </div>
      <div className={styles.gridTwo}>
        <label className={styles.field}>
          <span>Gender</span>
          <select defaultValue="" name="gender" required>
            <option disabled value="">
              Select one
            </option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
          </select>
        </label>
        <label className={styles.field}>
          <span>Age</span>
          <input min="1" name="age" required type="number" />
        </label>
      </div>
      <label className={styles.field}>
        <span>Average Manzanita score</span>
        <input max="120" min="20" name="averageScore" required type="number" />
      </label>
      <div className={styles.gridTwo}>
        <label className={styles.field}>
          <span>Pre-event adults</span>
          <input
            min="0"
            name="adultGuestCount"
            onChange={(event) => {
              const nextValue = Number.parseInt(event.target.value || "0", 10);

              setAdultGuestCount(
                Number.isNaN(nextValue) || nextValue < 0 ? 0 : nextValue,
              );
            }}
            required
            type="number"
            value={adultGuestCount}
          />
          <small className={styles.fieldHint}>
            Count only the additional adults attending the pre-event.
          </small>
        </label>
        <label className={styles.field}>
          <span>Pre-event children</span>
          <input
            min="0"
            name="childGuestCount"
            onChange={(event) => {
              const nextValue = Number.parseInt(event.target.value || "0", 10);

              setChildGuestCount(
                Number.isNaN(nextValue) || nextValue < 0 ? 0 : nextValue,
              );
            }}
            required
            type="number"
            value={childGuestCount}
          />
          <small className={styles.fieldHint}>
            Count only the additional children attending the pre-event.
          </small>
        </label>
      </div>
      <input
        name="packageSelection"
        type="hidden"
        value={defaultPackageSelection}
      />
      <fieldset className={styles.fieldset}>
        <legend>Day-before event RSVP</legend>
        <label className={styles.choiceRow}>
          <input name="dayBeforeRsvp" required type="radio" value="yes" />
          <span>Yes, include me in the day-before event RSVP list</span>
        </label>
        <label className={styles.choiceRow}>
          <input name="dayBeforeRsvp" type="radio" value="no" />
          <span>No, not this time</span>
        </label>
      </fieldset>
      {golfPriceLabel && totalLabel ? (
        <section className={styles.summaryCard}>
          <h3>Payment Summary</h3>
          <dl className={styles.summaryGrid}>
            {summaryItems.map((item) => (
              <div key={item.label}>
                <dt>{item.label}</dt>
                <dd>
                  {item.quantity} x {item.unitPriceLabel}
                </dd>
              </div>
            ))}
            <div className={styles.summaryValue}>
              <dt>Total due</dt>
              <dd>{totalLabel}</dd>
            </div>
          </dl>
        </section>
      ) : null}
      <label className={styles.field}>
        <span>Notes</span>
        <textarea
          name="notes"
          placeholder="If none, write None."
          required
          rows={4}
        />
      </label>
      <p className={styles.supportText}>
        Submitting opens a secure Square checkout in this tab. Your registration
        is finalized only after payment succeeds.
      </p>
      {error ? (
        <div aria-live="polite" className={styles.errorNotice}>
          {error}
        </div>
      ) : null}
      <button
        className={styles.submitButton}
        disabled={isSubmitting}
        type="submit"
      >
        <CreditCard aria-hidden="true" size={18} />
        {isSubmitting
          ? "Preparing secure Square checkout..."
          : "Continue to Square checkout"}
      </button>
      <div className={styles.notice}>
        <Flag aria-hidden="true" size={18} /> Pairings remain private until the
        chair publishes them.
      </div>
    </form>
  );
}
