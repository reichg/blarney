"use client";

import { DraftNotice } from "@/components/DraftNotice";
import styles from "@/app/forms.module.css";
import {
  feedbackCategoryOptions,
  feedbackRatingOptions,
} from "@/lib/formContracts";
import { useUncontrolledFormDraft } from "@/lib/useFormDraft";
import { MessageSquare } from "lucide-react";
import { useRef } from "react";

export type FeedbackFormProps = {
  submitFeedback: (formData: FormData) => void | Promise<void>;
};

export function FeedbackForm({ submitFeedback }: FeedbackFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const { wasRestored, clearDraft, handleChange } = useUncontrolledFormDraft({
    formId: "feedback",
    formVersion: 1,
    formRef,
  });

  return (
    <form
      action={submitFeedback}
      className={`${styles.panel} ${styles.form}`}
      // Plain server-action form: the action navigates on success, so clearing
      // the draft as the form submits is the success path.
      onInput={handleChange}
      onSubmit={() => clearDraft()}
      ref={formRef}
    >
      <DraftNotice
        onDiscard={() => {
          clearDraft();
          formRef.current?.reset();
        }}
        visible={wasRestored}
      />
      <div className={styles.gridTwo}>
        <label className={styles.field}>
          <span className={styles.requiredLabel}>Name</span>
          <input name="name" required type="text" />
        </label>
        <label className={styles.field}>
          <span className={styles.requiredLabel}>Email</span>
          <input name="email" required type="email" />
        </label>
      </div>
      <div className={styles.gridTwo}>
        <label className={styles.field}>
          <span className={styles.requiredLabel}>Category</span>
          <select defaultValue="" name="category" required>
            <option disabled value="">
              Select one
            </option>
            {feedbackCategoryOptions.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span className={styles.requiredLabel}>Rating</span>
          <select defaultValue="" name="rating" required>
            <option disabled value="">
              Select one
            </option>
            {feedbackRatingOptions.map((rating) => (
              <option key={rating} value={String(rating)}>
                {rating}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className={styles.field}>
        <span className={styles.requiredLabel}>Message</span>
        <textarea name="message" required rows={6} />
      </label>
      <button className={styles.submitButton} type="submit">
        <MessageSquare aria-hidden="true" size={18} />
        Send feedback
      </button>
    </form>
  );
}
