import styles from "@/app/forms.module.css";

export default function PhotoThanksPage() {
  return (
    <section className={styles.formSection}>
      <div className={styles.formShell}>
        <div className={styles.panel}>
          <p className="eyebrow">Photo submission received</p>
          <h1 className="section-title">It is ready for review.</h1>
          <p>
            Submitted photos are in the pending S3 area and will appear publicly
            after chair approval.
          </p>
        </div>
      </div>
    </section>
  );
}
