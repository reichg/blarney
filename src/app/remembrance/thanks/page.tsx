import formStyles from "@/app/forms.module.css";

export default function RemembranceThanksPage() {
  return (
    <section className={formStyles.formSection}>
      <div className={formStyles.formShell}>
        <div className={formStyles.panel}>
          <p className="eyebrow">Remembrance received</p>
          <h1 className="section-title">Thank you for sharing the memory.</h1>
          <p>
            The chair can review the note privately, along with any optional
            photos you included.
          </p>
        </div>
      </div>
    </section>
  );
}
