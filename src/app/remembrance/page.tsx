import formStyles from "@/app/forms.module.css";
import styles from "@/app/remembrance/remembrance.module.css";
import { RemembranceForm } from "@/app/remembrance/RemembranceForm";
import { ModularCard } from "@/components/ModularCard";

export default function RemembrancePage() {
  return (
    <>
      <header className={`${formStyles.pageHeader} ${styles.pageHeader}`}>
        <div className={formStyles.pageHeaderInner}>
          <p className="eyebrow">In Remembrance</p>
          <h1 className="section-title">
            A place to keep beloved names close.
          </h1>
          <p>
            If you have lost a family member, or want a late Blarney member to
            be remembered with this year&apos;s gathering, you can leave a note
            here for the chair.
          </p>
        </div>
      </header>
      <section className={formStyles.formSection}>
        <div className={`${formStyles.formShell} ${styles.shell}`}>
          <div className={styles.storyColumn}>
            <div className={styles.leadCard}>
              <p className="eyebrow">Warmly held</p>
              <h2>
                Some names stay part of the weekend long after the round ends.
              </h2>
              <p>
                Share a memory, a few lines about someone you miss, or a note
                about family connected to Blarney. The chair can gather these
                tributes privately and make sure they are remembered with care.
              </p>
            </div>
            <div className={styles.detailGrid}>
              <ModularCard as="section" className={styles.detailCard}>
                <h2>What to send</h2>
                <ul className={styles.detailList}>
                  <li>A short remembrance or story.</li>
                  <li>
                    The name of a family member or late Blarney participant.
                  </li>
                  <li>
                    An optional photo that helps the chair recognize the memory.
                  </li>
                </ul>
              </ModularCard>
              <ModularCard as="section" className={styles.detailCard}>
                <h2>How it is handled</h2>
                <p>
                  Remembrance notes go to the chair privately. Optional photos
                  stay private to the chair and are kept out of the public photo
                  gallery.
                </p>
              </ModularCard>
            </div>
          </div>
          <aside className={`${formStyles.panel} ${styles.formCard}`}>
            <div className={styles.formIntro}>
              <p className="eyebrow">Private submission</p>
              <h2>Leave a remembrance</h2>
              <p>
                The message is the important part. Photos are optional and can
                be added only if they feel helpful.
              </p>
            </div>
            <RemembranceForm />
          </aside>
        </div>
      </section>
    </>
  );
}
