import styles from "@/app/chair/chair.module.css";
import { PaginationNav } from "@/components/PaginationNav";
import { db } from "@/lib/db";
import {
  buildPaginationState,
  parsePaginationParams,
  type PaginationParams,
  type SearchParamsRecord,
} from "@/lib/pagination";
import type { RsvpSource } from "@prisma/client";

export const dynamic = "force-dynamic";

type ChairRsvpsPageProps = {
  searchParams: Promise<SearchParamsRecord>;
};

async function getRsvps(pagination: PaginationParams) {
  try {
    const [rsvps, totalCount] = await Promise.all([
      db.rsvp.findMany({
        include: {
          participant: {
            select: {
              age: true,
              registrations: {
                orderBy: [{ createdAt: "desc" }, { id: "desc" }],
                select: {
                  adultGuestCount: true,
                  childGuestCount: true,
                },
                take: 1,
              },
            },
          },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: pagination.skip,
        take: pagination.take,
      }),
      db.rsvp.count(),
    ]);

    return {
      rsvps,
      pagination: buildPaginationState(pagination, totalCount),
    };
  } catch {
    return {
      rsvps: [],
      pagination: buildPaginationState(pagination, 0),
    };
  }
}

function formatRsvpSource(source: RsvpSource): string {
  return source === "FORM" ? "RSVP form" : "Registration";
}

function formatGuestSummary(adultGuestCount: number, childGuestCount: number) {
  return `BBQ adults: ${adultGuestCount}, BBQ kids: ${childGuestCount}`;
}

function formatAttendeeTotal(attendeeCount: number) {
  if (attendeeCount === 0) {
    return "No BBQ attendees";
  }

  return `${attendeeCount} total BBQ attendee${attendeeCount === 1 ? "" : "s"}`;
}

function formatPartySummary(
  rsvp: Awaited<ReturnType<typeof getRsvps>>["rsvps"][number],
) {
  if (rsvp.adultAttendeeCount !== null && rsvp.childAttendeeCount !== null) {
    return {
      primary: formatGuestSummary(
        rsvp.adultAttendeeCount,
        rsvp.childAttendeeCount,
      ),
      secondary:
        rsvp.attendeeCount === 0
          ? undefined
          : formatAttendeeTotal(rsvp.attendeeCount),
    };
  }

  const registration = rsvp.participant?.registrations[0];

  if (rsvp.source === "REGISTRATION" && registration) {
    if (typeof rsvp.participant?.age === "number") {
      const golferIsAdult = rsvp.participant.age >= 15;
      const adultAttendeeCount =
        registration.adultGuestCount + (golferIsAdult ? 1 : 0);
      const childAttendeeCount =
        registration.childGuestCount + (golferIsAdult ? 0 : 1);

      return {
        primary: formatGuestSummary(adultAttendeeCount, childAttendeeCount),
        secondary: formatAttendeeTotal(rsvp.attendeeCount),
      };
    }

    return {
      primary: `${formatGuestSummary(registration.adultGuestCount, registration.childGuestCount)}, plus registrant`,
      secondary: formatAttendeeTotal(rsvp.attendeeCount),
    };
  }

  return {
    primary: formatAttendeeTotal(rsvp.attendeeCount),
  };
}

export default async function ChairRsvpsPage({
  searchParams,
}: ChairRsvpsPageProps) {
  const params = await searchParams;
  const paginationParams = parsePaginationParams(params);
  const { rsvps, pagination } = await getRsvps(paginationParams);

  return (
    <>
      <div className={styles.topline}>
        <div className={styles.pageHeaderCopy}>
          <p className="eyebrow">Private</p>
          <h1>RSVPs</h1>
          <p className={styles.pageIntro}>
            Track BBQ attendance, family groupings, and notes from both direct
            RSVP submissions and registration-sourced guest counts.
          </p>
          <div className={styles.pageMetaBar}>
            <span className={styles.pageMeta}>
              {pagination.totalCount} total RSVP
              {pagination.totalCount === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      </div>
      <section className={styles.sectionBlock}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionHeading}>
            <h2 className={styles.sectionTitle}>Current responses</h2>
            <p className={styles.sectionIntro}>
              RSVP form responses and registration-created BBQ attendance stay
              together here so headcount changes are easy to review.
            </p>
          </div>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>Source</th>
                <th>BBQ party</th>
                <th>Family</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {rsvps.length === 0 ? (
                <tr>
                  <td colSpan={7} className={styles.muted}>
                    {pagination.isEmpty
                      ? "No RSVPs yet."
                      : "No RSVPs on this page."}
                  </td>
                </tr>
              ) : (
                rsvps.map((rsvp) => {
                  const partySummary = formatPartySummary(rsvp);

                  return (
                    <tr key={rsvp.id}>
                      <td>
                        {rsvp.firstName} {rsvp.lastName}
                      </td>
                      <td>{rsvp.email}</td>
                      <td>
                        <span className={styles.statusPill}>
                          {rsvp.attending ? "BBQ RSVP" : "Legacy no-BBQ RSVP"}
                        </span>
                      </td>
                      <td>{formatRsvpSource(rsvp.source)}</td>
                      <td>
                        <div>{partySummary.primary}</div>
                        {partySummary.secondary ? (
                          <div className={styles.muted}>
                            {partySummary.secondary}
                          </div>
                        ) : null}
                      </td>
                      <td>{rsvp.familyNames}</td>
                      <td className={styles.notesCell}>
                        {rsvp.dietaryNotes}
                        {rsvp.notes ? <p>{rsvp.notes}</p> : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
      <PaginationNav
        label="RSVPs"
        pagination={pagination}
        searchParams={params}
      />
    </>
  );
}
