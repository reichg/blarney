import { submitRegistration } from "@/app/actions/registration";
import styles from "@/app/forms.module.css";
import { getEventSettings } from "@/lib/content";
import { CreditCard, Flag } from "lucide-react";

export default async function RegisterPage() {
  const settings = await getEventSettings();

  return (
    <>
      <header className={styles.pageHeader}>
        <div className={styles.pageHeaderInner}>
          <p className="eyebrow">Pay/Register</p>
          <h1 className="section-title">
            Reserve your place for {settings.eventTitle}.
          </h1>
          <p>{settings.registrationPriceLabel}</p>
        </div>
      </header>
      <section className={styles.formSection}>
        <div className={styles.formShell}>
          <aside className={styles.panel}>
            <h2>Registration Details</h2>
            <ul className={styles.detailList}>
              <li>{settings.registrationPackage}</li>
              <li>Average Manzanita score helps create fair groups.</li>
              <li>
                Scores of 41 and below are grouped as good golfers for pairing.
              </li>
              <li>
                Payment continues through the configured Square/Cash link after
                submission.
              </li>
            </ul>
          </aside>
          <form
            action={submitRegistration}
            className={`${styles.panel} ${styles.form}`}
          >
            <div className={styles.gridTwo}>
              <label className={styles.field}>
                <span>First name</span>
                <input name="firstName" required type="text" />
              </label>
              <label className={styles.field}>
                <span>Last name</span>
                <input name="lastName" required type="text" />
              </label>
            </div>
            <div className={styles.gridTwo}>
              <label className={styles.field}>
                <span>Email</span>
                <input name="email" required type="email" />
              </label>
              <label className={styles.field}>
                <span>Phone</span>
                <input name="phone" type="tel" />
              </label>
            </div>
            <div className={styles.gridTwo}>
              <label className={styles.field}>
                <span>Gender</span>
                <select name="gender" required>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="NON_BINARY">Non-binary</option>
                  <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
                </select>
              </label>
              <label className={styles.field}>
                <span>Age</span>
                <input min="1" name="age" required type="number" />
              </label>
            </div>
            <div className={styles.gridTwo}>
              <label className={styles.field}>
                <span>Average Manzanita score</span>
                <input
                  max="120"
                  min="20"
                  name="averageScore"
                  required
                  type="number"
                />
              </label>
              <label className={styles.field}>
                <span>Guests</span>
                <input
                  defaultValue="0"
                  min="0"
                  name="guestCount"
                  type="number"
                />
              </label>
            </div>
            <label className={styles.field}>
              <span>Package</span>
              <select name="packageSelection" required>
                <option value="Golf entry and weekend events">
                  Golf entry and weekend events
                </option>
                <option value="Golf only">Golf only</option>
                <option value="Family events only">Family events only</option>
              </select>
            </label>
            <label className={styles.choiceRow}>
              <input name="dayBeforeRsvp" type="checkbox" />
              <span>Include me in the day-before event RSVP list</span>
            </label>
            <label className={styles.field}>
              <span>Notes</span>
              <textarea name="notes" rows={4} />
            </label>
            <button className={styles.submitButton} type="submit">
              <CreditCard aria-hidden="true" size={18} />
              Register and continue
            </button>
            <div className={styles.notice}>
              <Flag aria-hidden="true" size={18} /> Pairings remain private
              until the chair publishes them.
            </div>
          </form>
        </div>
      </section>
    </>
  );
}
