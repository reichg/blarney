import { submitRsvp } from "@/app/actions/rsvp";
import styles from "@/app/forms.module.css";
import { RsvpForm } from "@/app/rsvp/RsvpForm";
import { getEventSettings } from "@/lib/content";

export default async function RsvpPage() {
  const settings = await getEventSettings();

  return (
    <>
      <header className={styles.pageHeader}>
        <div className={styles.pageHeaderInner}>
          <p className="eyebrow">RSVP</p>
          <h1 className="section-title">{settings.dayBeforeEventName}</h1>
          <p>
            Share attendance, adult and child counts, and family details for the
            day-before gathering.
          </p>
        </div>
      </header>
      <section className={styles.formSection}>
        <div className={styles.formShell}>
          <aside className={styles.panel}>
            <h2>Gathering Notes</h2>
            <p>
              RSVPs are private to the chair and help size food, seating, and
              welcome plans for golfers and families.
            </p>
          </aside>
          <RsvpForm submitAction={submitRsvp} />
        </div>
      </section>
    </>
  );
}
