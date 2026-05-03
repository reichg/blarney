import { submitFeedback } from "@/app/actions/feedback";
import styles from "@/app/forms.module.css";
import { MessageSquare } from "lucide-react";

export default function FeedbackPage() {
  return (
    <>
      <header className={styles.pageHeader}>
        <div className={styles.pageHeaderInner}>
          <p className="eyebrow">Feedback</p>
          <h1 className="section-title">Send notes for Blarney 42.</h1>
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
                <span>Name</span>
                <input name="name" type="text" />
              </label>
              <label className={styles.field}>
                <span>Email</span>
                <input name="email" type="email" />
              </label>
            </div>
            <div className={styles.gridTwo}>
              <label className={styles.field}>
                <span>Category</span>
                <select name="category" required>
                  <option value="Registration">Registration</option>
                  <option value="Logistics">Logistics</option>
                  <option value="Pairings">Pairings</option>
                  <option value="Photos">Photos</option>
                  <option value="Other">Other</option>
                </select>
              </label>
              <label className={styles.field}>
                <span>Rating</span>
                <select name="rating">
                  <option value="">No rating</option>
                  <option value="5">5</option>
                  <option value="4">4</option>
                  <option value="3">3</option>
                  <option value="2">2</option>
                  <option value="1">1</option>
                </select>
              </label>
            </div>
            <label className={styles.field}>
              <span>Message</span>
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
