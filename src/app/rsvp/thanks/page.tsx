import styles from "@/app/forms.module.css";

export default function RsvpThanksPage() {
  return (
    <section className={styles.formSection}>
      <div className={styles.formShell}>
        <div className={styles.panel}>
          <p className="eyebrow">RSVP received</p>
          <h1 className="section-title">Thank you.</h1>
          <p>The chair dashboard now has your day-before event response.</p>
        </div>
      </div>
    </section>
  );
}
