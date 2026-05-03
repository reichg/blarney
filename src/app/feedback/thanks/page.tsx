import styles from "@/app/forms.module.css";

export default function FeedbackThanksPage() {
  return (
    <section className={styles.formSection}>
      <div className={styles.formShell}>
        <div className={styles.panel}>
          <p className="eyebrow">Feedback received</p>
          <h1 className="section-title">Thank you for the note.</h1>
          <p>The chair can review it privately from the feedback dashboard.</p>
        </div>
      </div>
    </section>
  );
}
