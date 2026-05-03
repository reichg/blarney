import { submitRsvp } from "@/app/actions/rsvp";
import styles from "@/app/forms.module.css";
import { getEventSettings } from "@/lib/content";
import { CalendarCheck } from "lucide-react";

export default async function RsvpPage() {
  const settings = await getEventSettings();

  return (
    <>
      <header className={styles.pageHeader}>
        <div className={styles.pageHeaderInner}>
          <p className="eyebrow">RSVP</p>
          <h1 className="section-title">{settings.dayBeforeEventName}</h1>
          <p>
            Share attendance and family details for the day-before gathering.
          </p>
        </div>
      </header>
      <section className={styles.formSection}>
        <div className={styles.formShell}>
          <aside className={styles.panel}>
            <h2>Gathering Notes</h2>
            <p>
              RSVPs are private to the chair and help size the room, food, and
              welcome plans for families and golfers.
            </p>
          </aside>
          <form
            action={submitRsvp}
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
            <label className={styles.field}>
              <span>Email</span>
              <input name="email" required type="email" />
            </label>
            <fieldset className={styles.fieldset}>
              <legend>Attendance</legend>
              <label className={styles.choiceRow}>
                <input
                  defaultChecked
                  name="attending"
                  type="radio"
                  value="yes"
                />
                <span>Attending</span>
              </label>
              <label className={styles.choiceRow}>
                <input name="attending" type="radio" value="no" />
                <span>Not attending</span>
              </label>
            </fieldset>
            <label className={styles.field}>
              <span>Total attendees</span>
              <input
                defaultValue="1"
                min="0"
                name="attendeeCount"
                type="number"
              />
            </label>
            <label className={styles.field}>
              <span>Family names</span>
              <textarea name="familyNames" rows={3} />
            </label>
            <label className={styles.field}>
              <span>Dietary notes</span>
              <textarea name="dietaryNotes" rows={3} />
            </label>
            <label className={styles.field}>
              <span>Other notes</span>
              <textarea name="notes" rows={3} />
            </label>
            <button className={styles.submitButton} type="submit">
              <CalendarCheck aria-hidden="true" size={18} />
              Send RSVP
            </button>
          </form>
        </div>
      </section>
    </>
  );
}
