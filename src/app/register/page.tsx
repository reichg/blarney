import { submitRegistration } from "@/app/actions/registration";
import { submitRsvp } from "@/app/actions/rsvp";
import styles from "@/app/forms.module.css";
import { RegistrationForm } from "@/app/register/RegistrationForm";
import { getEventSettings } from "@/lib/content";
import { defaultRegistrationPackageSelection } from "@/lib/formContracts";
import { getOptionalRegistrationPaymentBreakdown } from "@/lib/payment";
import { Flag, UsersRound } from "lucide-react";

export default async function RegisterPage() {
  const settings = await getEventSettings();
  const pricing = getOptionalRegistrationPaymentBreakdown({
    golferCount: 1,
    bbqOnlyAdultCount: 0,
    bbqOnlyKidCount: 0,
  });
  const registrationPriceLabel = pricing
    ? `${pricing.golfPriceLabel} per golfer with BBQ included. BBQ-only guests are ${pricing.adultGuestPriceLabel} per adult and ${pricing.childGuestPriceLabel} per kid.`
    : settings.registrationPriceLabel;

  return (
    <>
      <header className={styles.pageHeader}>
        <div className={styles.pageHeaderInner}>
          <p className="eyebrow">Pay/Register</p>
          <h1 className="section-title">
            Register or RSVP for {settings.eventTitle}.
          </h1>
          <p>{registrationPriceLabel}</p>
        </div>
      </header>
      <section className={styles.formSection}>
        <div className={styles.formShell}>
          <aside className={styles.panelStack}>
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <span className={styles.panelBadge}>
                  <Flag aria-hidden="true" size={20} />
                </span>
                <div>
                  <p className={styles.panelKicker}>Plan ahead</p>
                  <h2>Registration details</h2>
                  <p className={styles.panelLead}>
                    Golfers, BBQ-only guests, and secure checkout all happen
                    right here on one page.
                  </p>
                </div>
              </div>
              <ul className={styles.detailList}>
                <li>
                  <strong>Every golf registration includes the BBQ.</strong>{" "}
                  Golfers never pay separately for it.
                </li>
                <li>
                  Bringing family or friends who are not golfing? Add them as
                  BBQ-only adults or kids.
                </li>
                <li>
                  No golfers in your party? Use the{" "}
                  <strong>BBQ-only RSVP</strong> — and count yourself as one of
                  the adults so we save you a plate.
                </li>
                <li>
                  Anyone under 15 counts as a kid in the BBQ totals, golfers
                  included. Golfers are never charged extra.
                </li>
                <li>
                  We ask each golfer for their average score at Manzanita (Par
                  32) so the chair can build fair pairings.
                </li>
              </ul>
            </section>
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <span className={styles.panelBadge}>
                  <UsersRound aria-hidden="true" size={20} />
                </span>
                <div>
                  <p className={styles.panelKicker}>Quick guide</p>
                  <h2>How headcounts work</h2>
                  <p className={styles.panelLead}>
                    Four quick rules cover pricing, BBQ totals, and pairings.
                  </p>
                </div>
              </div>
              <div className={styles.featureGrid}>
                <div className={styles.featureCard}>
                  <strong>Golf includes BBQ</strong>
                  <span>Golfers are covered — no extra BBQ charge.</span>
                </div>
                <div className={styles.featureCard}>
                  <strong>No golfers? RSVP here</strong>
                  <span>
                    BBQ-only parties RSVP on this same page. Remember to count
                    yourself.
                  </span>
                </div>
                <div className={styles.featureCard}>
                  <strong>Under 15 counts as a kid</strong>
                  <span>Applies to BBQ totals for everyone, golfers too.</span>
                </div>
                <div className={styles.featureCard}>
                  <strong>Scores shape pairings</strong>
                  <span>
                    Your average Manzanita score helps the chair build fair
                    groups.
                  </span>
                </div>
              </div>
            </section>
          </aside>
          <RegistrationForm
            currency={pricing?.currency ?? "USD"}
            defaultPackageSelection={defaultRegistrationPackageSelection}
            golfPriceCents={pricing?.golfPriceCents ?? null}
            golfPriceLabel={pricing?.golfPriceLabel ?? null}
            adultGuestPriceCents={pricing?.adultGuestPriceCents ?? null}
            adultGuestPriceLabel={pricing?.adultGuestPriceLabel ?? null}
            childGuestPriceCents={pricing?.childGuestPriceCents ?? null}
            childGuestPriceLabel={pricing?.childGuestPriceLabel ?? null}
            submitRegistrationAction={submitRegistration}
            submitRsvpAction={submitRsvp}
          />
        </div>
      </section>
    </>
  );
}
