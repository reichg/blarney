import styles from "@/app/forms.module.css";
import { getEventSettings } from "@/lib/content";
import { CalendarDays, MapPin, UsersRound } from "lucide-react";

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
        <div className={styles.formShell}>
          <article className={styles.panel}>
            <MapPin aria-hidden="true" color="var(--brass)" size={26} />
            <h2>Location</h2>
            <p>{settings.eventLocation}</p>
            <p>{settings.courseName}</p>
          </article>
          <div className={styles.panel}>
            <h2>Weekend Plan</h2>
            <ul className={styles.detailList}>
              <li>
                <CalendarDays
                  aria-hidden="true"
                  color="var(--brass)"
                  size={18}
                />{" "}
                {settings.eventDates}
              </li>
              <li>{settings.eventTime}</li>
              <li>{settings.dayBeforeEventName}</li>
              <li>
                Pairings and tee times will publish to the Home page once
                finalized.
              </li>
              <li>
                <UsersRound aria-hidden="true" color="var(--brass)" size={18} />{" "}
                Chair contact: {settings.chairContact}
              </li>
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}
