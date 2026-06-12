import styles from "@/app/forms.module.css";
import { getEventSettings } from "@/lib/content";
import { CalendarDays, MapPin } from "lucide-react";

export default async function LogisticsPage() {
  const settings = await getEventSettings();

  return (
    <>
      <header className={styles.pageHeader}>
        <div className={styles.pageHeaderInner}>
          <p className="eyebrow">Logistics</p>
          <h1 className="section-title">Everything in one place.</h1>
          <p>{settings.logisticsSummary}</p>
        </div>
      </header>
      <section className={styles.formSection}>
        <div
          className={`${styles.formShell} ${styles.balancedShell} ${styles.equalShell}`}
        >
          <article className={`${styles.panel} ${styles.panelStack}`}>
            <div className={styles.panelHeader}>
              <span className={styles.panelBadge}>
                <MapPin aria-hidden="true" size={22} />
              </span>
              <div>
                <p className={styles.panelKicker}>Where to be</p>
                <h2>Course and location</h2>
                <p className={styles.panelLead}>
                  Keep the arrival details close so the weekend starts without
                  guesswork.
                </p>
              </div>
            </div>
            <div className={styles.featureGrid}>
              <div className={styles.featureCard}>
                <strong>{settings.eventLocation}</strong>
                <span>Main event location</span>
              </div>
              <div className={styles.featureCard}>
                <strong>{settings.courseName}</strong>
                <span>Course for the round and gathering</span>
              </div>
            </div>
          </article>
          <article className={`${styles.panel} ${styles.panelStack}`}>
            <div className={styles.panelHeader}>
              <span className={styles.panelBadge}>
                <CalendarDays aria-hidden="true" size={22} />
              </span>
              <div>
                <p className={styles.panelKicker}>When to expect things</p>
                <h2>Weekend plan</h2>
                <p className={styles.panelLead}>
                  A quick view of the schedule, the day-before event, and how
                  updates will be shared.
                </p>
              </div>
            </div>
            <ul className={styles.detailList}>
              <li>{settings.dayBeforeEventName}</li>
              <li>
                Pairings and tee times will publish to the Home page once
                finalized.
              </li>
              <li>
                Keep Pay/Register handy if your party size or golf plans change.
              </li>
            </ul>
            <div className={styles.featureGrid}>
              <div className={styles.featureCard}>
                <strong>{settings.eventDates}</strong>
                <span>{settings.eventTime}</span>
              </div>
              <div className={styles.featureCard}>
                <strong>Chair contact</strong>
                <span>{settings.chairContact}</span>
              </div>
            </div>
          </article>
        </div>
      </section>
    </>
  );
}
