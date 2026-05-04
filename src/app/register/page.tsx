import { submitRegistration } from "@/app/actions/registration";
import styles from "@/app/forms.module.css";
import { RegistrationForm } from "@/app/register/RegistrationForm";
import { getEventSettings } from "@/lib/content";
import { getOptionalRegistrationPaymentBreakdown } from "@/lib/payment";

export default async function RegisterPage() {
  const settings = await getEventSettings();
  const pricing = getOptionalRegistrationPaymentBreakdown({
    adultGuestCount: 0,
    childGuestCount: 0,
  });
  const registrationPriceLabel = pricing
    ? `${pricing.golfPriceLabel} golfer registration, plus ${pricing.adultGuestPriceLabel} per adult and ${pricing.childGuestPriceLabel} per child for the pre-event.`
    : settings.registrationPriceLabel;

  return (
    <>
      <header className={styles.pageHeader}>
        <div className={styles.pageHeaderInner}>
          <p className="eyebrow">Pay/Register</p>
          <h1 className="section-title">
            Reserve your place for {settings.eventTitle}.
          </h1>
          <p>{registrationPriceLabel}</p>
        </div>
      </header>
      <section className={styles.formSection}>
        <div className={styles.formShell}>
          <aside className={styles.panel}>
            <h2>Registration Details</h2>
            <ul className={styles.detailList}>
              <li>
                One golfer registration with optional per-person pre-event
                guests.
              </li>
              {pricing ? (
                <li>
                  {pricing.golfPriceLabel} per golfer,{" "}
                  {pricing.adultGuestPriceLabel} per adult guest, and{" "}
                  {pricing.childGuestPriceLabel} per child guest.
                </li>
              ) : null}
              <li>Average Manzanita score helps create fair groups.</li>
              <li>
                Scores of 41 and below are grouped as good golfers for pairing.
              </li>
              <li>
                Secure Square checkout comes next. Your registration is
                finalized only after payment succeeds.
              </li>
            </ul>
          </aside>
          <RegistrationForm
            currency={pricing?.currency ?? "USD"}
            defaultPackageSelection="Golf registration"
            golfPriceCents={pricing?.golfPriceCents ?? null}
            golfPriceLabel={pricing?.golfPriceLabel ?? null}
            adultGuestPriceCents={pricing?.adultGuestPriceCents ?? null}
            adultGuestPriceLabel={pricing?.adultGuestPriceLabel ?? null}
            childGuestPriceCents={pricing?.childGuestPriceCents ?? null}
            childGuestPriceLabel={pricing?.childGuestPriceLabel ?? null}
            submitAction={submitRegistration}
          />
        </div>
      </section>
    </>
  );
}
