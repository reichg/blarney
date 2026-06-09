import { type HomePageProps } from "@/app/type";
import { PaginationNav } from "@/components/PaginationNav";
import { getEventSettings } from "@/lib/content";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import {
  buildPaginationState,
  parsePaginationParams,
  type PaginationParams,
} from "@/lib/pagination";
import {
  CalendarDays,
  Flag,
  Images,
  MessageSquare,
  ShoppingBag,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

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
        <div className={styles.heroOverlay} />
        <div className={styles.heroContent}>
          <div className={styles.heroCopy}>
            <p className="eyebrow">{settings.eventLocation}</p>
            <h1>{settings.eventTitle}</h1>
            <p>{settings.logisticsSummary}</p>
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
          <aside className={styles.heroPanel}>
            <p className={styles.heroPanelEyebrow}>Weekend at a glance</p>
            <div className={styles.heroPanelList}>
              <div className={styles.heroPanelItem}>
                <span className={styles.heroPanelLabel}>Dates</span>
                <strong>{settings.eventDates}</strong>
              </div>
              <div className={styles.heroPanelItem}>
                <span className={styles.heroPanelLabel}>Tee window</span>
                <strong>{settings.eventTime}</strong>
              </div>
              <div className={styles.heroPanelItem}>
                <span className={styles.heroPanelLabel}>Course</span>
                <strong>{settings.courseName}</strong>
              </div>
              <div className={styles.heroPanelItem}>
                <span className={styles.heroPanelLabel}>Chair contact</span>
                <strong>{settings.chairContact}</strong>
              </div>
            </div>
            <div className={styles.heroPanelLinks}>
              <Link className={styles.heroPanelLink} href="/marketplace">
                <ShoppingBag aria-hidden="true" size={18} />
                Browse marketplace
              </Link>
              <Link className={styles.heroPanelLink} href="/photos">
                <Images aria-hidden="true" size={18} />
                Browse photos
              </Link>
              <Link className={styles.heroPanelLink} href="/feedback">
                <MessageSquare aria-hidden="true" size={18} />
                Send feedback
              </Link>
            </div>
          </aside>
        </div>
      </section>

      <section className={`section ${styles.pairingSection}`}>
        <div className="section-inner">
          <div className={styles.pairingShell}>
            <div className={styles.pairingHeader}>
              <div className={styles.pairingIntro}>
                <p className="eyebrow">Pairings and tee times</p>
                <h2 className="section-title">The first tee, once set.</h2>
                <p className="section-copy">
                  Published groups appear here as soon as the chair finalizes
                  the draw.
                </p>
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
        </div>
      </section>

      <section className={`section ${styles.overviewSection}`}>
        <div className="section-inner">
          <div className="section-intro">
            <p className="eyebrow">Plan the weekend</p>
            <h2 className="section-title">
              Everything guests need, without the clutter.
            </h2>
            <p className="section-copy">
              Start with Pay/Register, confirm the weekend plan, browse the
              gallery, and leave the chair a note from one clear home page.
            </p>
          </div>
          <div className={styles.overviewGrid}>
            <article className={styles.overviewItem}>
              <div className={styles.overviewIcon}>
                <UsersRound aria-hidden="true" color="var(--brass)" size={24} />
              </div>
              <h3>Pay/Register</h3>
              <p>
                Register golfers, add BBQ-only guests, or send a BBQ-only RSVP
                from one streamlined form.
              </p>
              <Link className={styles.overviewLink} href="/register">
                Start registration
              </Link>
            </article>
            <article className={styles.overviewItem}>
              <div className={styles.overviewIcon}>
                <CalendarDays
                  aria-hidden="true"
                  color="var(--brass)"
                  size={24}
                />
              </div>
              <h3>Weekend logistics</h3>
              <p>
                Keep the date, time, location, and pre-event details close at
                hand without hunting through messages.
              </p>
              <Link className={styles.overviewLink} href="/logistics">
                View logistics
              </Link>
            </article>
            <article className={styles.overviewItem}>
              <div className={styles.overviewIcon}>
                <Images aria-hidden="true" color="var(--brass)" size={24} />
              </div>
              <h3>Photos</h3>
              <p>
                Share favorite tournament shots for review, then browse the
                approved public gallery.
              </p>
              <Link className={styles.overviewLink} href="/photos">
                Open gallery
              </Link>
            </article>
            <article className={styles.overviewItem}>
              <div className={styles.overviewIcon}>
                <MessageSquare
                  aria-hidden="true"
                  color="var(--brass)"
                  size={24}
                />
              </div>
              <h3>Feedback</h3>
              <p>
                Send private notes about registration, logistics, pairings, or
                family events directly to the chair.
              </p>
              <Link className={styles.overviewLink} href="/feedback">
                Share feedback
              </Link>
            </article>
          </div>
        </div>
      </section>
    </>
  );
}
