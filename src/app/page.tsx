import { PaginationNav } from "@/components/PaginationNav";
import { getEventSettings } from "@/lib/content";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import {
  buildPaginationState,
  parsePaginationParams,
  type PaginationParams,
  type SearchParamsRecord,
} from "@/lib/pagination";
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

type HomePageProps = {
  searchParams: Promise<SearchParamsRecord>;
};

async function getPublishedPairings(pagination: PaginationParams) {
  try {
    const where = { status: "PUBLISHED" as const };
    const [pairings, totalCount] = await Promise.all([
      db.pairingGroup.findMany({
        where,
        include: {
          members: {
            include: { participant: true },
            orderBy: { slot: "asc" },
          },
        },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        skip: pagination.skip,
        take: pagination.take,
      }),
      db.pairingGroup.count({ where }),
    ]);

    return {
      pairings,
      pagination: buildPaginationState(pagination, totalCount),
    };
  } catch {
    return {
      pairings: [],
      pagination: buildPaginationState(pagination, 0),
    };
  }
}

export default async function Home({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const paginationParams = parsePaginationParams(params);
  const [settings, publishedPairings] = await Promise.all([
    getEventSettings(),
    getPublishedPairings(paginationParams),
  ]);
  const pairings = publishedPairings.pairings;

  return (
    <>
      <section className={styles.hero}>
        <Image
          alt="Golf green above the coast"
          className={styles.heroImage}
          fill
          priority
          sizes="100vw"
          src="/images/background.png"
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
              Register or RSVP
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
                {publishedPairings.pagination.isEmpty
                  ? "Pairings and tee times will appear here after the chair reviews and publishes them."
                  : "No published pairings on this page."}
              </div>
            )}
            <PaginationNav
              label="Published pairings"
              pagination={publishedPairings.pagination}
              searchParams={params}
            />
          </div>
          <hr className={styles.sectionDivider} />
          <div className={styles.overviewGrid}>
            <article className={styles.overviewItem}>
              <UsersRound aria-hidden="true" color="var(--brass)" size={24} />
              <h3>Register or RSVP</h3>
              <p>
                Register golfers, add BBQ-only adults or kids, or send a
                BBQ-only RSVP from one Pay/Register form.
              </p>
            </article>
            <article className={styles.overviewItem}>
              <CalendarDays aria-hidden="true" color="var(--brass)" size={24} />
              <h3>Payment Handoff</h3>
              <p>
                Golf registration includes BBQ, and BBQ-only RSVPs continue to
                Square checkout for adult and kid counts.
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
    </>
  );
}
