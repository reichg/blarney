import { submitFeedback } from "@/app/actions/feedback";
import styles from "@/app/forms.module.css";
import {
  feedbackCategoryOptions,
  feedbackRatingOptions,
} from "@/lib/formContracts";
import { MessageSquare } from "lucide-react";

export default function FeedbackPage() {
  return (
    <>
      <header className={styles.pageHeader}>
        <div className={styles.pageHeaderInner}>
          <p className="eyebrow">Feedback</p>
          <h1 className="section-title">How can we improve The Blarney?</h1>
          <p>Feedback is collected privately for the chair.</p>
        </div>
      </header>
      <section className={styles.formSection}>
        <div className={styles.formShell}>
          <aside className={styles.panel}>
            <h2>Helpful Topics</h2>
            <ul className={styles.detailList}>
              <li>Registration and payments</li>
              <li>Golf pairings and tee times</li>
              <li>Family events and logistics</li>
              <li>Photo gallery and memories</li>
            </ul>
          </aside>
          <form
            action={submitFeedback}
            className={`${styles.panel} ${styles.form}`}
          >
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
        </div>
      </section>
    </>
  );
}
