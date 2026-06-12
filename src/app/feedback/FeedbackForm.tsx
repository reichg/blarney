"use client";

import {
  FEEDBACK_NOTICE_PARAM,
  FEEDBACK_NOTICES,
} from "@/app/feedback/feedbackNotices";
import styles from "@/app/forms.module.css";
import { DraftNotice } from "@/components/DraftNotice";
import { PendingSubmitButton } from "@/components/notices/PendingSubmitButton";
import type { NoticeFormAction } from "@/components/notices/type";
import { useActionNavigation } from "@/components/notices/useActionNavigation";
import {
  feedbackCategoryOptions,
  feedbackRatingOptions,
} from "@/lib/formContracts";
import { useUncontrolledFormDraft } from "@/lib/useFormDraft";
import { MessageSquare } from "lucide-react";
import { useRef } from "react";

export type FeedbackFormProps = {
  submitFeedback: NoticeFormAction;
};

export function FeedbackForm({ submitFeedback }: FeedbackFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const runAction = useActionNavigation(FEEDBACK_NOTICE_PARAM, FEEDBACK_NOTICES);
  const { wasRestored, clearDraft, handleChange } = useUncontrolledFormDraft({
    formId: "feedback",
    formVersion: 1,
    formRef,
  });

  return (
    <form
      // Failure surfaces a toast and keeps the visitor on the form, so the
      // draft is only cleared on the success path before navigating away.
      action={runAction(submitFeedback, { onResult: clearDraft })}
      className={`${styles.panel} ${styles.form}`}
      onInput={handleChange}
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
      <PendingSubmitButton className={styles.submitButton}>
        <MessageSquare aria-hidden="true" size={18} />
        Send feedback
      </PendingSubmitButton>
    </form>
  );
}
