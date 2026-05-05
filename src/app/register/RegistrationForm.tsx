"use client";

import type { SubmitRegistrationResult } from "@/app/actions/registration";
import type { SubmitRsvpResult } from "@/app/actions/rsvp";
import styles from "@/app/forms.module.css";
import { CreditCard, Flag, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";

const checkoutStorageKey = "blarney.registrationCheckout";
const maxGolferCount = 20;

type RegistrationFormProps = {
  currency: string;
  defaultPackageSelection: string;
  golfPriceCents: number | null;
  golfPriceLabel: string | null;
  adultGuestPriceCents: number | null;
  adultGuestPriceLabel: string | null;
  childGuestPriceCents: number | null;
  childGuestPriceLabel: string | null;
  submitRegistrationAction: (
    formData: FormData,
  ) => Promise<SubmitRegistrationResult>;
  submitRsvpAction: (formData: FormData) => Promise<SubmitRsvpResult>;
};

type SummaryItem = {
  label: string;
  quantity: number;
  unitPriceLabel: string;
};

type PendingCheckoutResume = {
  kind: "registration" | "rsvp";
  checkoutId: string;
  paymentPath: string;
  thanksPath: string;
};

type SignupMode = "golf" | "bbq";

type Golfer = {
  id: string;
  firstName: string;
  lastName: string;
  gender: string;
  age: string;
  averageScore: string;
};

type GolferField = Exclude<keyof Golfer, "id">;

function createGolfer(id: number): Golfer {
  return {
    id: `golfer-${id}`,
    firstName: "",
    lastName: "",
    gender: "",
    age: "",
    averageScore: "",
  };
}

function formatCurrency(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

function parseCountValue(value: string) {
  const nextValue = Number.parseInt(value || "0", 10);

  return Number.isNaN(nextValue) || nextValue < 0 ? 0 : nextValue;
}

function parseAgeValue(value: string) {
  const age = Number.parseInt(value, 10);

  return Number.isNaN(age) ? null : age;
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
  submitRegistrationAction,
  submitRsvpAction,
}: RegistrationFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<SignupMode>("golf");
  const [nextGolferId, setNextGolferId] = useState(2);
  const [golfers, setGolfers] = useState<Golfer[]>(() => [createGolfer(1)]);
  const [bbqOnlyAdultCount, setBbqOnlyAdultCount] = useState(0);
  const [bbqOnlyKidCount, setBbqOnlyKidCount] = useState(0);
  const [rsvpAdultCount, setRsvpAdultCount] = useState(1);
  const [rsvpKidCount, setRsvpKidCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingCheckout, setPendingCheckout] =
    useState<PendingCheckoutResume | null>(null);
  const isGolfMode = mode === "golf";
  const paymentKind = isGolfMode ? "registration" : "rsvp";
  const golferAges = golfers.map((golfer) => parseAgeValue(golfer.age));
  const golferKidCount = golferAges.filter(
    (age): age is number => age !== null && age < 15,
  ).length;
  const golferAdultCount = golferAges.filter(
    (age): age is number => age !== null && age >= 15,
  ).length;
  const golferUnknownAgeCount =
    golfers.length - golferKidCount - golferAdultCount;
  const rsvpAttendeeCount = rsvpAdultCount + rsvpKidCount;
  const payableGolfCount = isGolfMode ? golfers.length : 0;
  const payableAdultCount = isGolfMode ? bbqOnlyAdultCount : rsvpAdultCount;
  const payableKidCount = isGolfMode ? bbqOnlyKidCount : rsvpKidCount;
  const totalCents = isGolfMode
    ? golfPriceCents !== null &&
      adultGuestPriceCents !== null &&
      childGuestPriceCents !== null
      ? payableGolfCount * golfPriceCents +
        payableAdultCount * adultGuestPriceCents +
        payableKidCount * childGuestPriceCents
      : null
    : adultGuestPriceCents !== null && childGuestPriceCents !== null
      ? payableAdultCount * adultGuestPriceCents +
        payableKidCount * childGuestPriceCents
      : null;
  const totalLabel =
    totalCents === null ? null : formatCurrency(totalCents, currency);
  const summaryItems: SummaryItem[] = [];

  if (isGolfMode && golfPriceLabel) {
    summaryItems.push({
      label: "Golf registration (BBQ included)",
      quantity: payableGolfCount,
      unitPriceLabel: golfPriceLabel,
    });
  }

  if (adultGuestPriceLabel && payableAdultCount > 0) {
    summaryItems.push({
      label: "BBQ-only adults",
      quantity: payableAdultCount,
      unitPriceLabel: adultGuestPriceLabel,
    });
  }

  if (childGuestPriceLabel && payableKidCount > 0) {
    summaryItems.push({
      label: "BBQ-only kids",
      quantity: payableKidCount,
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
          setPendingCheckout({
            ...parsed,
            kind: parsed.kind ?? "registration",
          });
        });
      }
    } catch {
      window.sessionStorage.removeItem(checkoutStorageKey);
    }
  }, []);

  function handleModeChange(event: ChangeEvent<HTMLInputElement>) {
    const nextMode = event.target.value === "bbq" ? "bbq" : "golf";

    setMode(nextMode);
    setError(null);

    if (nextMode === "bbq" && rsvpAdultCount + rsvpKidCount === 0) {
      setRsvpAdultCount(1);
    }
  }

  function updateGolfer(golferId: string, field: GolferField, value: string) {
    setGolfers((currentGolfers) =>
      currentGolfers.map((golfer) =>
        golfer.id === golferId ? { ...golfer, [field]: value } : golfer,
      ),
    );
  }

  function addGolfer() {
    if (golfers.length >= maxGolferCount) {
      return;
    }

    setGolfers((currentGolfers) => [
      ...currentGolfers,
      createGolfer(nextGolferId),
    ]);
    setNextGolferId((currentId) => currentId + 1);
  }

  function removeGolfer(golferId: string) {
    setGolfers((currentGolfers) =>
      currentGolfers.length === 1
        ? currentGolfers
        : currentGolfers.filter((golfer) => golfer.id !== golferId),
    );
  }

  async function submitGolfRegistration(formData: FormData) {
    formData.set("packageSelection", defaultPackageSelection);
    formData.set("bbqOnlyAdultCount", String(bbqOnlyAdultCount));
    formData.set("bbqOnlyKidCount", String(bbqOnlyKidCount));

    const result = await submitRegistrationAction(formData);

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
        kind: "registration" as const,
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
  }

  async function submitBbqRsvp(formData: FormData) {
    if (rsvpAttendeeCount === 0) {
      setError("Add at least one BBQ attendee before continuing to payment.");
      setIsSubmitting(false);
      return;
    }

    formData.set("adultAttendeeCount", String(rsvpAdultCount));
    formData.set("childAttendeeCount", String(rsvpKidCount));

    const result = await submitRsvpAction(formData);

    if (!result.ok) {
      setError(result.error);
      setIsSubmitting(false);
      return;
    }

    if (result.requiresPayment) {
      if (result.alreadyConfirmed) {
        try {
          window.sessionStorage.removeItem(checkoutStorageKey);
        } catch {
          // Session storage can be unavailable; confirmation still works.
        }
      } else {
        const nextCheckout = {
          kind: "rsvp" as const,
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
      return;
    }

    try {
      window.sessionStorage.removeItem(checkoutStorageKey);
    } catch {
      // Session storage can be unavailable; RSVP submission still works.
    }

    router.push(result.thanksPath);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const selectedMode = formData.get("signupMode");
    const isGolfSubmission = selectedMode === "golf";

    void (async () => {
      try {
        if (selectedMode !== "golf" && selectedMode !== "bbq") {
          setError("Choose golf registration or BBQ-only RSVP.");
          setIsSubmitting(false);
          return;
        }

        formData.delete("signupMode");

        if (isGolfSubmission) {
          await submitGolfRegistration(formData);
          return;
        }

        await submitBbqRsvp(formData);
      } catch {
        setError(
          isGolfSubmission
            ? "Registration could not be submitted. Please try again."
            : "RSVP could not be submitted. Please try again.",
        );
        setIsSubmitting(false);
      }
    })();
  }

  const submitButtonText = isSubmitting
    ? "Preparing secure Square checkout..."
    : "Continue to checkout";

  return (
    <form
      aria-busy={isSubmitting}
      className={`${styles.panel} ${styles.form}`}
      onSubmit={handleSubmit}
    >
      <fieldset className={styles.fieldset}>
        <legend>Signup type</legend>
        <label className={styles.choiceRow}>
          <input
            checked={isGolfMode}
            name="signupMode"
            onChange={handleModeChange}
            required
            type="radio"
            value="golf"
          />
          <span>Golf registration</span>
        </label>
        <label className={styles.choiceRow}>
          <input
            checked={!isGolfMode}
            name="signupMode"
            onChange={handleModeChange}
            type="radio"
            value="bbq"
          />
          <span>BBQ-only RSVP</span>
        </label>
      </fieldset>

      {pendingCheckout && pendingCheckout.kind === paymentKind ? (
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
          <span>Payer first name</span>
          <input name="firstName" required type="text" />
        </label>
        <label className={styles.field}>
          <span>Payer last name</span>
          <input name="lastName" required type="text" />
        </label>
      </div>
      <div className={styles.gridTwo}>
        <label className={styles.field}>
          <span>Email</span>
          <input name="email" required type="email" />
        </label>
        <label className={styles.field}>
          <span>Phone (optional)</span>
          <input name="phone" type="tel" />
        </label>
      </div>

      {isGolfMode ? (
        <>
          <div className={styles.formSubsection}>
            <div className={styles.subsectionHeader}>
              <div>
                <h3>Golfers</h3>
                <p className={styles.supportText}>
                  Every golfer is included in the BBQ headcount.
                </p>
              </div>
              <button
                className={styles.addButton}
                disabled={golfers.length >= maxGolferCount}
                onClick={addGolfer}
                type="button"
              >
                <Plus aria-hidden="true" size={18} /> Add golfer
              </button>
            </div>
            <div className={styles.golferList}>
              {golfers.map((golfer, index) => {
                const golferNumber = index + 1;

                return (
                  <fieldset className={styles.golferRow} key={golfer.id}>
                    <legend>Golfer {golferNumber}</legend>
                    {golfers.length > 1 ? (
                      <div className={styles.golferActions}>
                        <button
                          aria-label={`Remove golfer ${golferNumber}`}
                          className={styles.removeButton}
                          onClick={() => {
                            removeGolfer(golfer.id);
                          }}
                          type="button"
                        >
                          <Trash2 aria-hidden="true" size={16} /> Remove
                        </button>
                      </div>
                    ) : null}
                    <div className={styles.gridTwo}>
                      <label className={styles.field}>
                        <span>Golfer {golferNumber} first name</span>
                        <input
                          name="golferFirstName"
                          onChange={(event) => {
                            updateGolfer(
                              golfer.id,
                              "firstName",
                              event.target.value,
                            );
                          }}
                          required
                          type="text"
                          value={golfer.firstName}
                        />
                      </label>
                      <label className={styles.field}>
                        <span>Golfer {golferNumber} last name</span>
                        <input
                          name="golferLastName"
                          onChange={(event) => {
                            updateGolfer(
                              golfer.id,
                              "lastName",
                              event.target.value,
                            );
                          }}
                          required
                          type="text"
                          value={golfer.lastName}
                        />
                      </label>
                    </div>
                    <div className={styles.gridTwo}>
                      <label className={styles.field}>
                        <span>Golfer {golferNumber} gender</span>
                        <select
                          name="golferGender"
                          onChange={(event) => {
                            updateGolfer(
                              golfer.id,
                              "gender",
                              event.target.value,
                            );
                          }}
                          required
                          value={golfer.gender}
                        >
                          <option disabled value="">
                            Select one
                          </option>
                          <option value="MALE">Male</option>
                          <option value="FEMALE">Female</option>
                        </select>
                      </label>
                      <label className={styles.field}>
                        <span>Golfer {golferNumber} age</span>
                        <input
                          min="1"
                          name="golferAge"
                          onChange={(event) => {
                            updateGolfer(golfer.id, "age", event.target.value);
                          }}
                          required
                          type="number"
                          value={golfer.age}
                        />
                      </label>
                    </div>
                    <label className={styles.field}>
                      <span>
                        Golfer {golferNumber} average Manzanita score (Par 32)
                      </span>
                      <input
                        max="120"
                        min="20"
                        name="golferAverageScore"
                        onChange={(event) => {
                          updateGolfer(
                            golfer.id,
                            "averageScore",
                            event.target.value,
                          );
                        }}
                        required
                        type="number"
                        value={golfer.averageScore}
                      />
                      <small className={styles.fieldHint}>
                        Average Manzanita score (Par 32).
                      </small>
                    </label>
                  </fieldset>
                );
              })}
            </div>
          </div>

          <fieldset className={styles.fieldset}>
            <legend>Additional BBQ-only guests</legend>
            <div className={styles.gridTwo}>
              <label className={styles.field}>
                <span>BBQ-only adults not golfing</span>
                <input
                  max="30"
                  min="0"
                  name="bbqOnlyAdultCount"
                  onChange={(event) => {
                    setBbqOnlyAdultCount(parseCountValue(event.target.value));
                  }}
                  required
                  type="number"
                  value={bbqOnlyAdultCount}
                />
              </label>
              <label className={styles.field}>
                <span>BBQ-only kids not golfing</span>
                <input
                  max="30"
                  min="0"
                  name="bbqOnlyKidCount"
                  onChange={(event) => {
                    setBbqOnlyKidCount(parseCountValue(event.target.value));
                  }}
                  required
                  type="number"
                  value={bbqOnlyKidCount}
                />
              </label>
            </div>
          </fieldset>

          <section aria-live="polite" className={styles.summaryCard}>
            <h3>BBQ Headcount</h3>
            <dl className={styles.summaryGrid}>
              <div>
                <dt>Golfers 15 and older</dt>
                <dd>{golferAdultCount}</dd>
              </div>
              <div>
                <dt>Golfers under 15</dt>
                <dd>{golferKidCount}</dd>
              </div>
              {golferUnknownAgeCount > 0 ? (
                <div>
                  <dt>Golfers needing age</dt>
                  <dd>{golferUnknownAgeCount}</dd>
                </div>
              ) : null}
              <div>
                <dt>Additional BBQ-only adults</dt>
                <dd>{bbqOnlyAdultCount}</dd>
              </div>
              <div>
                <dt>Additional BBQ-only kids</dt>
                <dd>{bbqOnlyKidCount}</dd>
              </div>
              <div className={styles.summaryValue}>
                <dt>Known BBQ total</dt>
                <dd>
                  {golferAdultCount +
                    golferKidCount +
                    bbqOnlyAdultCount +
                    bbqOnlyKidCount}
                </dd>
              </div>
            </dl>
            <p className={styles.supportText}>
              Golfers under 15 count as kids for BBQ totals. Golfers are not
              charged again for BBQ.
            </p>
          </section>

          <label className={styles.field}>
            <span>Dietary notes</span>
            <textarea
              name="dietaryNotes"
              placeholder="Meal notes for golfers or BBQ-only guests."
              rows={3}
              required
            />
          </label>
          <label className={styles.field}>
            <span>Registration notes</span>
            <textarea
              name="notes"
              placeholder="Pairing notes, seating notes, or anything the chair should know."
              rows={4}
            />
          </label>
        </>
      ) : (
        <>
          <fieldset className={styles.fieldset}>
            <legend>BBQ-only attendees</legend>
            <div className={styles.gridTwo}>
              <label className={styles.field}>
                <span>BBQ-only adults</span>
                <input
                  max="30"
                  min="0"
                  name="adultAttendeeCount"
                  onChange={(event) => {
                    setRsvpAdultCount(parseCountValue(event.target.value));
                  }}
                  required
                  type="number"
                  value={rsvpAdultCount}
                />
              </label>
              <label className={styles.field}>
                <span>BBQ-only kids</span>
                <input
                  max="30"
                  min="0"
                  name="childAttendeeCount"
                  onChange={(event) => {
                    setRsvpKidCount(parseCountValue(event.target.value));
                  }}
                  required
                  type="number"
                  value={rsvpKidCount}
                />
              </label>
            </div>
            <p aria-live="polite" className={styles.supportText}>
              Total BBQ attendees: {rsvpAttendeeCount}
            </p>
          </fieldset>
          <label className={styles.field}>
            <span>Family or guest names</span>
            <textarea
              name="familyNames"
              placeholder="List everyone joining the BBQ."
              required
              rows={3}
            />
          </label>
          <label className={styles.field}>
            <span>Dietary notes</span>
            <textarea
              name="dietaryNotes"
              placeholder="If none, write None."
              required
              rows={3}
            />
          </label>
          <label className={styles.field}>
            <span>BBQ notes</span>
            <textarea
              name="notes"
              placeholder="If none, write None."
              required
              rows={3}
            />
          </label>
        </>
      )}

      {summaryItems.length > 0 && totalLabel ? (
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

      <p className={styles.supportText}>
        Submitting opens a secure Square checkout in this tab. Your
        {isGolfMode ? " registration" : " BBQ RSVP"} is finalized only after
        payment succeeds.
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
        {submitButtonText}
      </button>
      <div className={styles.notice}>
        <Flag aria-hidden="true" size={18} /> Pairings remain private until the
        chair publishes them.
      </div>
    </form>
  );
}
