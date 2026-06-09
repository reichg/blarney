import { requireChairPageAuth } from "@/lib/chairAuth.server";
import { getChairDashboardInsights } from "@/lib/chairDashboard";
import Link from "next/link";
import styles from "./chair.module.css";

export const dynamic = "force-dynamic";

type ActionItem = {
  href: string;
  label: string;
  count: number;
  hint: string;
};

export default async function ChairDashboardPage() {
  await requireChairPageAuth("/chair");

  const insights = await getChairDashboardInsights();

  const actionItems: ActionItem[] = [
    {
      href: "/chair/registrations",
      label: "Pending payments",
      count: insights.registrations.pendingPayment,
      hint: "Registrations awaiting payment confirmation.",
    },
    {
      href: "/chair/photos",
      label: "Pending photos",
      count: insights.photos.pending,
      hint: "Gallery uploads waiting on chair review.",
    },
    {
      href: "/chair/marketplace",
      label: "Marketplace needs review",
      count: insights.marketplace.needsReview,
      hint: "Orders flagged for chair attention.",
    },
    {
      href: "/chair/marketplace",
      label: "Marketplace unfulfilled",
      count: insights.marketplace.unfulfilled,
      hint: "Paid orders still to be fulfilled.",
    },
    {
      href: "/chair/pairings",
      label: "Draft pairings",
      count: insights.pairings.draft,
      hint: "Unpublished groups still being adjusted.",
    },
    {
      href: "/chair/pairings",
      label: "Unassigned golfers",
      count: insights.pairings.unassigned,
      hint: "Paid golfers not yet placed in a group.",
    },
  ];

  const totalActionCount = actionItems.reduce(
    (sum, item) => sum + item.count,
    0,
  );

  const averageRating =
    insights.feedback.averageRating === null
      ? "—"
      : insights.feedback.averageRating.toFixed(1);

  return (
    <>
      <div className={styles.topline}>
        <div className={styles.pageHeaderCopy}>
          <p className="eyebrow">Private</p>
          <h1>Chair Dashboard</h1>
          <p className={styles.pageIntro}>
            A single chair-only summary of every admin area — registrations,
            BBQ attendance, the marketplace, feedback, photos, remembrance, and
            pairings — with the items that need attention surfaced first.
          </p>
        </div>
        <Link className="secondary-button" href="/">
          View site
        </Link>
      </div>

      <section className={styles.sectionBlock} aria-labelledby="action-needed">
        <div className={styles.sectionHeader}>
          <div className={styles.sectionHeading}>
            <h2 className={styles.sectionTitle} id="action-needed">
              Action needed
            </h2>
            <p className={styles.sectionIntro}>
              {totalActionCount > 0
                ? "Open work across every admin area, prioritized for quick follow-up."
                : "Nothing is waiting on you right now. These cards highlight work as it arrives."}
            </p>
          </div>
        </div>
        <div className={styles.actionRow}>
          {actionItems.map((item) => {
            const isActive = item.count > 0;
            return (
              <Link
                key={`${item.label}-${item.href}`}
                className={`${styles.actionItem} ${
                  isActive ? styles.actionItemActive : styles.actionItemCalm
                }`}
                href={item.href}
              >
                <span className={styles.actionItemLabel}>{item.label}</span>
                <strong className={styles.actionItemCount}>{item.count}</strong>
                <small className={styles.actionItemHint}>{item.hint}</small>
              </Link>
            );
          })}
        </div>
      </section>

      <section className={styles.sectionBlock} aria-labelledby="at-a-glance">
        <div className={styles.sectionHeader}>
          <div className={styles.sectionHeading}>
            <h2 className={styles.sectionTitle} id="at-a-glance">
              At a glance
            </h2>
            <p className={styles.sectionIntro}>
              One insight card per admin area. Select a card to open the full
              page.
            </p>
          </div>
        </div>
        <div className={styles.insightGroups}>
          <div className={styles.insightGroup}>
            <h3 className={styles.insightGroupTitle}>
              Registration &amp; Attendance
            </h3>
            <div className={styles.insightGroupGrid}>
              <Link className={styles.insightCard} href="/chair/registrations">
                <div className={styles.insightCardHead}>
                  <h3 className={styles.insightCardTitle}>Golf Registrations</h3>
                  <span className={styles.insightCardHint}>Open</span>
                </div>
                <div className={styles.cardMetaGrid}>
                  <div className={styles.metric}>
                    <span>Complete</span>
                    <strong>{insights.registrations.complete}</strong>
                  </div>
                  <div className={styles.metric}>
                    <span>Pending payment</span>
                    <strong>{insights.registrations.pendingPayment}</strong>
                  </div>
                  <div className={styles.metric}>
                    <span>Golfers (A / K)</span>
                    <strong>
                      {insights.registrations.golfers.adults} /{" "}
                      {insights.registrations.golfers.kids}
                    </strong>
                  </div>
                  <div className={styles.metric}>
                    <span>Guests total</span>
                    <strong>{insights.registrations.guests.total}</strong>
                  </div>
                </div>
              </Link>

              <Link className={styles.insightCard} href="/chair/rsvps">
                <div className={styles.insightCardHead}>
                  <h3 className={styles.insightCardTitle}>BBQ RSVPs</h3>
                  <span className={styles.insightCardHint}>Open</span>
                </div>
                <div className={styles.cardMetaGrid}>
                  <div className={styles.metric}>
                    <span>RSVPs</span>
                    <strong>{insights.rsvps.total}</strong>
                  </div>
                  <div className={styles.metric}>
                    <span>Total attendees</span>
                    <strong>{insights.rsvps.totalAttendees}</strong>
                  </div>
                  <div className={styles.metric}>
                    <span>Adults</span>
                    <strong>{insights.rsvps.adultAttendees}</strong>
                  </div>
                  <div className={styles.metric}>
                    <span>Kids</span>
                    <strong>{insights.rsvps.kidAttendees}</strong>
                  </div>
                </div>
              </Link>

              <Link className={styles.insightCard} href="/chair/pairings">
                <div className={styles.insightCardHead}>
                  <h3 className={styles.insightCardTitle}>Pairings</h3>
                  <span className={styles.insightCardHint}>Open</span>
                </div>
                <div className={styles.cardMetaGrid}>
                  <div className={styles.metric}>
                    <span>Paid golfers</span>
                    <strong>{insights.pairings.paidGolfers}</strong>
                  </div>
                  <div className={styles.metric}>
                    <span>Unassigned</span>
                    <strong>{insights.pairings.unassigned}</strong>
                  </div>
                  <div className={styles.metric}>
                    <span>Draft groups</span>
                    <strong>{insights.pairings.draft}</strong>
                  </div>
                  <div className={styles.metric}>
                    <span>Published</span>
                    <strong>{insights.pairings.published}</strong>
                  </div>
                </div>
              </Link>
            </div>
          </div>

          <div className={styles.insightGroup}>
            <h3 className={styles.insightGroupTitle}>Marketplace</h3>
            <div className={styles.insightGroupGrid}>
              <Link className={styles.insightCard} href="/chair/marketplace">
                <div className={styles.insightCardHead}>
                  <h3 className={styles.insightCardTitle}>Marketplace</h3>
                  <span className={styles.insightCardHint}>Open</span>
                </div>
                <div className={styles.cardMetaGrid}>
                  <div className={styles.metric}>
                    <span>Needs review</span>
                    <strong>{insights.marketplace.needsReview}</strong>
                  </div>
                  <div className={styles.metric}>
                    <span>Unfulfilled</span>
                    <strong>{insights.marketplace.unfulfilled}</strong>
                  </div>
                  <div className={styles.metric}>
                    <span>Ready</span>
                    <strong>{insights.marketplace.ready}</strong>
                  </div>
                  <div className={styles.metric}>
                    <span>Fulfilled</span>
                    <strong>{insights.marketplace.fulfilled}</strong>
                  </div>
                  <div className={styles.metric}>
                    <span>Active listings</span>
                    <strong>{insights.marketplace.activeListings}</strong>
                  </div>
                  <div className={styles.metric}>
                    <span>Draft listings</span>
                    <strong>{insights.marketplace.draftListings}</strong>
                  </div>
                </div>
              </Link>
            </div>
          </div>

          <div className={styles.insightGroup}>
            <h3 className={styles.insightGroupTitle}>Community</h3>
            <div className={styles.insightGroupGrid}>
              <Link className={styles.insightCard} href="/chair/feedback">
                <div className={styles.insightCardHead}>
                  <h3 className={styles.insightCardTitle}>Feedback</h3>
                  <span className={styles.insightCardHint}>Open</span>
                </div>
                <div className={styles.cardMetaGrid}>
                  <div className={styles.metric}>
                    <span>Messages</span>
                    <strong>{insights.feedback.total}</strong>
                  </div>
                  <div className={styles.metric}>
                    <span>Average rating</span>
                    <strong>{averageRating}</strong>
                  </div>
                </div>
              </Link>

              <Link className={styles.insightCard} href="/chair/photos">
                <div className={styles.insightCardHead}>
                  <h3 className={styles.insightCardTitle}>Photos</h3>
                  <span className={styles.insightCardHint}>Open</span>
                </div>
                <div className={styles.cardMetaGrid}>
                  <div className={styles.metric}>
                    <span>Pending review</span>
                    <strong>{insights.photos.pending}</strong>
                  </div>
                  <div className={styles.metric}>
                    <span>Approved</span>
                    <strong>{insights.photos.approved}</strong>
                  </div>
                </div>
              </Link>

              <Link className={styles.insightCard} href="/chair/remembrance">
                <div className={styles.insightCardHead}>
                  <h3 className={styles.insightCardTitle}>Remembrance</h3>
                  <span className={styles.insightCardHint}>Open</span>
                </div>
                <div className={styles.cardMetaGrid}>
                  <div className={styles.metric}>
                    <span>Submissions</span>
                    <strong>{insights.remembrance.total}</strong>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.sectionBlock} aria-labelledby="jump-to">
        <div className={styles.sectionHeader}>
          <div className={styles.sectionHeading}>
            <h2 className={styles.sectionTitle} id="jump-to">
              Jump to
            </h2>
            <p className={styles.sectionIntro}>
              Direct links to every chair management area.
            </p>
          </div>
        </div>
        <div className={styles.quickLinkGrid}>
          <Link className={styles.quickLinkCard} href="/chair/registrations">
            <h2>Golf Registrations</h2>
            <p>Review golfers, packages, and payment status.</p>
          </Link>
          <Link className={styles.quickLinkCard} href="/chair/rsvps">
            <h2>BBQ RSVPs</h2>
            <p>Track BBQ attendance and family party counts.</p>
          </Link>
          <Link className={styles.quickLinkCard} href="/chair/marketplace">
            <h2>Marketplace</h2>
            <p>Manage listings, review orders, and fulfillment.</p>
          </Link>
          <Link className={styles.quickLinkCard} href="/chair/feedback">
            <h2>Feedback</h2>
            <p>Read private public-site feedback messages.</p>
          </Link>
          <Link className={styles.quickLinkCard} href="/chair/photos">
            <h2>Photos</h2>
            <p>Approve, reject, and curate gallery uploads.</p>
          </Link>
          <Link className={styles.quickLinkCard} href="/chair/remembrance">
            <h2>Remembrance</h2>
            <p>Review private remembrance submissions.</p>
          </Link>
          <Link className={styles.quickLinkCard} href="/chair/pairings">
            <h2>Pairings</h2>
            <p>Generate, adjust, and publish tee-sheet groups.</p>
          </Link>
        </div>
      </section>
    </>
  );
}
