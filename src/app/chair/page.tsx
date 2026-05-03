import { db } from "@/lib/db";
import Link from "next/link";
import styles from "./chair.module.css";

export const dynamic = "force-dynamic";

async function getDashboardCounts() {
  try {
    const [
      registrations,
      rsvps,
      feedback,
      pendingPhotos,
      draftPairings,
      publishedPairings,
    ] = await Promise.all([
      db.registration.count(),
      db.rsvp.count(),
      db.feedback.count(),
      db.photoSubmission.count({ where: { status: "PENDING" } }),
      db.pairingGroup.count({ where: { status: "DRAFT" } }),
      db.pairingGroup.count({ where: { status: "PUBLISHED" } }),
    ]);

    return {
      registrations,
      rsvps,
      feedback,
      pendingPhotos,
      draftPairings,
      publishedPairings,
    };
  } catch {
    return {
      registrations: 0,
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
        <div>
          <p className="eyebrow">Private</p>
          <h1>Chair Dashboard</h1>
        </div>
        <Link className="secondary-button" href="/">
          View site
        </Link>
      </div>
      <div className={styles.statGrid}>
        <div className={styles.stat}>
          <span>Registrations</span>
          <strong>{counts.registrations}</strong>
        </div>
        <div className={styles.stat}>
          <span>RSVPs</span>
          <strong>{counts.rsvps}</strong>
        </div>
        <div className={styles.stat}>
          <span>Feedback</span>
          <strong>{counts.feedback}</strong>
        </div>
        <div className={styles.stat}>
          <span>Pending Photos</span>
          <strong>{counts.pendingPhotos}</strong>
        </div>
        <div className={styles.stat}>
          <span>Draft Pairings</span>
          <strong>{counts.draftPairings}</strong>
        </div>
        <div className={styles.stat}>
          <span>Published Pairings</span>
          <strong>{counts.publishedPairings}</strong>
        </div>
      </div>
    </>
  );
}
