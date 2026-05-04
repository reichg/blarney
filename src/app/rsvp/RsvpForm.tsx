"use client";

import type { SubmitRsvpResult } from "@/app/actions/rsvp";
import styles from "@/app/forms.module.css";
import { CalendarCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ChangeEvent, type FormEvent } from "react";

type RsvpFormProps = {
  submitAction: (formData: FormData) => Promise<SubmitRsvpResult>;
};

function parseCountValue(value: string) {
  const nextValue = Number.parseInt(value || "0", 10);

  return Number.isNaN(nextValue) || nextValue < 0 ? 0 : nextValue;
}

export function RsvpForm({ submitAction }: RsvpFormProps) {
  const router = useRouter();
  const [adultAttendeeCount, setAdultAttendeeCount] = useState(0);
  const [childAttendeeCount, setChildAttendeeCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const attendeeCount = adultAttendeeCount + childAttendeeCount;

  function handleAttendingChoiceChange(event: ChangeEvent<HTMLInputElement>) {
    const nextValue = event.target.value === "yes" ? "yes" : "no";

    if (nextValue === "no") {
      setAdultAttendeeCount(0);
      setChildAttendeeCount(0);
      return;
    }

    if (adultAttendeeCount + childAttendeeCount === 0) {
      setAdultAttendeeCount(1);
    }
  }

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

        router.push(result.thanksPath);
      } catch {
        setError("RSVP could not be submitted. Please try again.");
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
      <label className={styles.field}>
        <span>Email</span>
        <input name="email" required type="email" />
      </label>
      <fieldset className={styles.fieldset}>
        <legend>Attendance</legend>
        <label className={styles.choiceRow}>
          <input
            name="attending"
            onChange={handleAttendingChoiceChange}
            required
            type="radio"
            value="yes"
          />
          <span>Attending</span>
        </label>
        <label className={styles.choiceRow}>
          <input
            name="attending"
            onChange={handleAttendingChoiceChange}
            type="radio"
            value="no"
          />
          <span>Not attending</span>
        </label>
      </fieldset>
      <div className={styles.gridTwo}>
        <label className={styles.field}>
          <span>Adults attending</span>
          <input
            min="0"
            name="adultAttendeeCount"
            onChange={(event) => {
              setAdultAttendeeCount(parseCountValue(event.target.value));
            }}
            required
            type="number"
            value={adultAttendeeCount}
          />
          <small className={styles.fieldHint}>
            Include yourself if you are attending as an adult.
          </small>
        </label>
        <label className={styles.field}>
          <span>Children attending</span>
          <input
            min="0"
            name="childAttendeeCount"
            onChange={(event) => {
              setChildAttendeeCount(parseCountValue(event.target.value));
            }}
            required
            type="number"
            value={childAttendeeCount}
          />
          <small className={styles.fieldHint}>
            Count all children in your party attending the gathering.
          </small>
        </label>
      </div>
      <p aria-live="polite" className={styles.supportText}>
        Total attendees: {attendeeCount}
      </p>
      <label className={styles.field}>
        <span>Family names</span>
        <textarea
          name="familyNames"
          placeholder="List attendees, or write None."
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
        <span>Other notes</span>
        <textarea
          name="notes"
          placeholder="If none, write None."
          required
          rows={3}
        />
      </label>
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
        <CalendarCheck aria-hidden="true" size={18} />
        {isSubmitting ? "Sending RSVP..." : "Send RSVP"}
      </button>
    </form>
  );
}
