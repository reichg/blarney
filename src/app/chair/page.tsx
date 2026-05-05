import { db } from "@/lib/db";
import { completeRegistrationPaymentStatuses } from "@/lib/payment";
import Link from "next/link";
import styles from "./chair.module.css";

export const dynamic = "force-dynamic";

async function getDashboardCounts() {
  try {
    const [
      completeRegistrations,
      pendingPaymentRegistrations,
      rsvps,
      feedback,
      pendingPhotos,
      draftPairings,
      publishedPairings,
    ] = await Promise.all([
      db.registration.count({
        where: {
          paymentStatus: { in: [...completeRegistrationPaymentStatuses] },
        },
      }),
      db.registration.count({ where: { paymentStatus: "EXTERNAL_PENDING" } }),
      db.rsvp.count(),
      db.feedback.count(),
      db.photoSubmission.count({ where: { status: "PENDING" } }),
      db.pairingGroup.count({ where: { status: "DRAFT" } }),
      db.pairingGroup.count({ where: { status: "PUBLISHED" } }),
    ]);

    return {
      completeRegistrations,
      pendingPaymentRegistrations,
      rsvps,
      feedback,
      pendingPhotos,
      draftPairings,
      publishedPairings,
    };
  } catch {
    return {
      completeRegistrations: 0,
      pendingPaymentRegistrations: 0,
      rsvps: 0,
      feedback: 0,
      pendingPhotos: 0,
      draftPairings: 0,
      publishedPairings: 0,
    };
  }
}

export default async function ChairDashboardPage() {
  const counts = await getDashboardCounts();

  return (
    <>
      <div className={styles.topline}>
        <div className={styles.pageHeaderCopy}>
          <p className="eyebrow">Private</p>
          <h1>Chair Dashboard</h1>
          <p className={styles.pageIntro}>
            Keep registrations, guest responses, private notes, photos,
            remembrance, and pairings in one structured chair-only view.
          </p>
        </div>
        <Link className="secondary-button" href="/">
          View site
        </Link>
      </div>
      <section className={styles.sectionBlock}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionHeading}>
            <h2 className={styles.sectionTitle}>Current snapshot</h2>
            <p className={styles.sectionIntro}>
              Live counts across registrations, attendance, photo moderation,
              and pairing status.
            </p>
          </div>
        </div>
        <div className={styles.statGrid}>
          <Link
            className={`${styles.stat} ${styles.statLink}`}
            href="/chair/registrations"
          >
            <span>Complete Registrations</span>
            <strong>{counts.completeRegistrations}</strong>
            <small>Confirmed golfers and completed package selections.</small>
          </Link>
          <Link
            className={`${styles.stat} ${styles.statLink}`}
            href="/chair/registrations"
          >
            <span>Pending Payment</span>
            <strong>{counts.pendingPaymentRegistrations}</strong>
            <small>Registrations waiting on payment confirmation.</small>
          </Link>
          <Link
            className={`${styles.stat} ${styles.statLink}`}
            href="/chair/rsvps"
          >
            <span>RSVPs</span>
            <strong>{counts.rsvps}</strong>
            <small>
              BBQ attendance, party counts, and family grouping notes.
            </small>
          </Link>
          <Link
            className={`${styles.stat} ${styles.statLink}`}
            href="/chair/feedback"
          >
            <span>Feedback</span>
            <strong>{counts.feedback}</strong>
            <small>Private public-site messages and remembrance notes.</small>
          </Link>
          <Link
            className={`${styles.stat} ${styles.statLink}`}
            href="/chair/photos"
          >
            <span>Pending Photos</span>
            <strong>{counts.pendingPhotos}</strong>
            <small>Gallery uploads that still need chair review.</small>
          </Link>
          <Link
            className={`${styles.stat} ${styles.statLink}`}
            href="/chair/pairings"
          >
            <span>Draft Pairings</span>
            <strong>{counts.draftPairings}</strong>
            <small>Unpublished groups that can still be adjusted.</small>
          </Link>
          <Link
            className={`${styles.stat} ${styles.statLink}`}
            href="/chair/pairings"
          >
            <span>Published Pairings</span>
            <strong>{counts.publishedPairings}</strong>
            <small>Currently visible tee sheets on the public site.</small>
          </Link>
        </div>
      </section>
    </>
  );
}
