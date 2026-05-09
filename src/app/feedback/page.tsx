import { submitFeedback } from "@/app/actions/feedback";
import styles from "@/app/forms.module.css";
import {
  feedbackCategoryOptions,
  feedbackRatingOptions,
} from "@/lib/formContracts";
import { MessageSquare, UsersRound } from "lucide-react";

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
          <aside className={styles.panelStack}>
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <span className={styles.panelBadge}>
                  <MessageSquare aria-hidden="true" size={20} />
                </span>
                <div>
                  <p className={styles.panelKicker}>Useful starting points</p>
                  <h2>Helpful topics</h2>
                  <p className={styles.panelLead}>
                    If you are not sure where to begin, these are the areas the
                    chair reviews most often.
                  </p>
                </div>
              </div>
              <ul className={styles.detailList}>
                <li>Registration and payments</li>
                <li>Golf pairings and tee times</li>
                <li>Family events and logistics</li>
                <li>Photo gallery and memories</li>
              </ul>
            </section>
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <span className={styles.panelBadge}>
                  <UsersRound aria-hidden="true" size={20} />
                </span>
                <div>
                  <p className={styles.panelKicker}>What helps most</p>
                  <h2>Better notes, faster fixes</h2>
                  <p className={styles.panelLead}>
                    Specific context makes it easier to act on feedback before
                    the next weekend.
                  </p>
                </div>
              </div>
              <div className={styles.featureGrid}>
                <div className={styles.featureCard}>
                  <strong>Name the moment</strong>
                  <span>
                    Say which page, event, or process you are talking about.
                  </span>
                </div>
                <div className={styles.featureCard}>
                  <strong>Mention timing</strong>
                  <span>
                    Include when the issue happened so the chair can trace it
                    quickly.
                  </span>
                </div>
                <div className={styles.featureCard}>
                  <strong>Call out what worked</strong>
                  <span>
                    Positive feedback is useful too when deciding what to keep.
                  </span>
                </div>
                <div className={styles.featureCard}>
                  <strong>Share one improvement</strong>
                  <span>
                    A clear suggestion is easier to act on than a vague note.
                  </span>
                </div>
              </div>
            </section>
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
