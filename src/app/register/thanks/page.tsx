import styles from "@/app/forms.module.css";
import { CreditCard } from "lucide-react";

export default function RegisterThanksPage() {
  const paymentUrl = process.env.SQUARE_PAYMENT_URL;

  return (
    <section className={styles.formSection}>
      <div className={styles.formShell}>
        <div className={styles.panel}>
          <p className="eyebrow">Registration received</p>
          <h1 className="section-title">You are on the list.</h1>
          <p>
            Continue to the Square/Cash payment page when the payment link is
            configured. The chair can review registration details privately from
            the chair dashboard.
          </p>
          {paymentUrl ? (
            <a
              className="primary-button"
              href={paymentUrl}
              rel="noreferrer"
              target="_blank"
            >
              <CreditCard aria-hidden="true" size={18} />
              Continue to payment
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}
