import { getEventSettings } from "@/lib/content";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import {
  CalendarDays,
  Flag,
  Images,
  MessageSquare,
  UsersRound,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

async function getPublishedPairings() {
  try {
    return await db.pairingGroup.findMany({
      where: { status: "PUBLISHED" },
      include: {
        members: {
          include: { participant: true },
          orderBy: { slot: "asc" },
        },
      },
      orderBy: { sortOrder: "asc" },
    });
  } catch {
    return [];
  }
}

export default async function Home() {
  const [settings, pairings] = await Promise.all([
    getEventSettings(),
    getPublishedPairings(),
  ]);

  return (
    <>
      <section className={styles.hero}>
        <Image
          alt="Golf green above the coast"
          className={styles.heroImage}
          fill
          priority
          sizes="100vw"
          src="https://images.unsplash.com/photo-1535131749006-b7f58c99034b?auto=format&fit=crop&w=1800&q=80"
        />
        <div className={styles.heroOverlay} />
        <div className={styles.heroContent}>
          <p className="eyebrow">{settings.eventLocation}</p>
          <h1>{settings.eventTitle}</h1>
          <p>{settings.logisticsSummary}</p>
          <div className={styles.heroFacts}>
            <span className={styles.heroFact}>{settings.eventDates}</span>
            <span className={styles.heroFact}>{settings.eventTime}</span>
            <span className={styles.heroFact}>{settings.courseName}</span>
          </div>
          <div className="button-row">
            <Link className="primary-button" href="/register">
              <Flag aria-hidden="true" size={18} />
              Register
            </Link>
            <Link className="secondary-button" href="/logistics">
              <CalendarDays aria-hidden="true" size={18} />
              Logistics
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-inner">
          <div className={styles.overviewGrid}>
            <article className={styles.overviewItem}>
              <UsersRound aria-hidden="true" color="var(--brass)" size={24} />
              <h3>Register and Pay</h3>
              <p>
                Golfers and family can choose events, add golf details, and
                continue to the Square/Cash payment link.
              </p>
            </article>
            <article className={styles.overviewItem}>
              <CalendarDays aria-hidden="true" color="var(--brass)" size={24} />
              <h3>RSVP</h3>
              <p>
                Day-before attendance, family counts, and notes stay organized
                for the chair.
              </p>
            </article>
            <article className={styles.overviewItem}>
              <Images aria-hidden="true" color="var(--brass)" size={24} />
              <h3>Photos</h3>
              <p>
                Past tournament memories can be submitted for chair review
                before they reach the public gallery.
              </p>
            </article>
            <article className={styles.overviewItem}>
              <MessageSquare
                aria-hidden="true"
                color="var(--brass)"
                size={24}
              />
              <h3>Feedback</h3>
              <p>
                Participants can send notes that are collected privately for the
                chair.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="section" id="pairings">
        <div className="section-inner">
          <div className={styles.pairingHeader}>
            <div>
              <p className="eyebrow">Pairings and tee times</p>
              <h2 className="section-title">The first tee, once set.</h2>
            </div>
            <Link className="secondary-button" href="/register">
              <Flag aria-hidden="true" size={18} />
              Add golf details
            </Link>
          </div>

          {pairings.length ? (
            <div className={styles.pairingGrid}>
              {pairings.map((group) => (
                <article className={styles.pairingGroup} key={group.id}>
                  <h3>{group.name}</h3>
                  <p>{formatDateTime(group.teeTime)}</p>
                  <ul className={styles.memberList}>
                    {group.members.map((member) => (
                      <li key={member.id}>
                        <span>
                          {member.participant.firstName}{" "}
                          {member.participant.lastName}
                        </span>
                        <span>{member.snapshotScore}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              Pairings and tee times will appear here after the chair reviews
              and publishes them.
            </div>
          )}
        </div>
      </section>
    </>
  );
}
