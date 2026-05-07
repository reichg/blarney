import { submitRegistration } from "@/app/actions/registration";
import { submitRsvp } from "@/app/actions/rsvp";
import styles from "@/app/forms.module.css";
import { RegistrationForm } from "@/app/register/RegistrationForm";
import { getEventSettings } from "@/lib/content";
import { defaultRegistrationPackageSelection } from "@/lib/formContracts";
import { getOptionalRegistrationPaymentBreakdown } from "@/lib/payment";

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
          <aside className={styles.panel}>
            <h2>Registration Details</h2>
            <ul className={styles.detailList}>
              <li>
                <strong>
                  Golf registration includes BBQ for every golfer.
                </strong>
              </li>
              <li>
                Add extra BBQ-only adults or kids who are not golfing, or use
                BBQ-only RSVP for a non-golfing party.
              </li>
              <li>
                BBQ-only RSVP for a non-golfing party needs to include the payer as a BBQ-only adult to be included in the headcount for catering.
              </li>
              <li>
                Golfers under 15 count as kids for BBQ totals. Golfers are not
                charged again for BBQ.
              </li>
              <li>
                Average Manzanita score (Par 32) helps create fair groups for
                golfers.
              </li>
            </ul>
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
