import { submitFeedback } from "@/app/actions/feedback";
import { FeedbackForm } from "@/app/feedback/FeedbackForm";
import styles from "@/app/forms.module.css";
import { MessageSquare, UsersRound } from "lucide-react";

export default function FeedbackPage() {
  return (
    <>
      <header className={styles.pageHeader}>
        <div className={styles.pageHeaderInner}>
          <p className="eyebrow">Feedback</p>
          <h1 className="section-title">How can we improve The Blarney?</h1>
          <p>Feedback is collected privately for the chair.
          </p>
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
          <FeedbackForm submitFeedback={submitFeedback} />
        </div>
      </section>
    </>
  );
}
