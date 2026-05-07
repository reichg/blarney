import styles from "@/app/chair/chair.module.css";
import { displayValue, joinSearchText } from "@/app/chair/display";
import { FilterableCardGrid } from "@/app/chair/FilterableCardGrid";
import {
  parseChairListFilterParam,
  pickSearchParams,
} from "@/app/chair/listFiltering";
import { PreviewDetailCard } from "@/app/chair/PreviewDetailCard";
import { PaginationNav } from "@/components/PaginationNav";
import { requireChairPageAuth } from "@/lib/chairAuth.server";
import {
  getChairRsvpPartyCounts,
  sumChairRsvpPartyCounts,
  type ChairRsvpPartyCounts,
} from "@/lib/chairRsvps";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import {
  buildPaginationState,
  parsePaginationParams,
  type PaginationParams,
  type SearchParamsRecord,
} from "@/lib/pagination";
import type { Prisma, RsvpSource } from "@prisma/client";

export const dynamic = "force-dynamic";

type ChairRsvpsPageProps = {
  searchParams: Promise<SearchParamsRecord>;
};

const chairRsvpFilterParamKey = "filter";
const chairRsvpSources = ["FORM", "REGISTRATION"] as const;

const chairRsvpPartyCountsSelect = {
  source: true,
  adultAttendeeCount: true,
  childAttendeeCount: true,
  attendeeCount: true,
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
} satisfies Prisma.RsvpSelect;

type ChairRsvpHeaderTotals = {
  overall: ChairRsvpPartyCounts;
  filtered: ChairRsvpPartyCounts | null;
};

function parseRsvpFilter(searchParams: SearchParamsRecord | undefined) {
  const filterValue = parseChairListFilterParam(
    searchParams,
    chairRsvpFilterParamKey,
  );

  if (
    filterValue === "attending:yes" ||
    filterValue === "attending:no" ||
    filterValue === "notes:yes" ||
    filterValue === "notes:no"
  ) {
    return filterValue;
  }

  if (filterValue.startsWith("source:")) {
    const source = filterValue.slice("source:".length).trim().toUpperCase();

    return chairRsvpSources.includes(
      source as (typeof chairRsvpSources)[number],
    )
      ? `source:${source}`
      : "";
  }

  return "";
}

function buildRsvpWhere(filterValue: string): Prisma.RsvpWhereInput {
  switch (filterValue) {
    case "attending:yes":
      return { attending: true };
    case "attending:no":
      return { attending: false };
    case "notes:yes":
      return {
        AND: [{ notes: { not: null } }, { NOT: { notes: "" } }],
      };
    case "notes:no":
      return {
        OR: [{ notes: null }, { notes: "" }],
      };
    default:
      if (filterValue.startsWith("source:")) {
        return {
          source: filterValue.slice("source:".length) as RsvpSource,
        };
      }

      return {};
  }
}

async function getRsvps(pagination: PaginationParams, filterValue: string) {
  const rsvpWhere = buildRsvpWhere(filterValue);
  const hasFilter = Boolean(filterValue);

  try {
    const [rsvps, totalCount, filteredPartyCounts, overallPartyCounts] =
      await Promise.all([
        db.rsvp.findMany({
          where: rsvpWhere,
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
        db.rsvp.count({ where: rsvpWhere }),
        db.rsvp.findMany({
          select: chairRsvpPartyCountsSelect,
          where: rsvpWhere,
        }),
        hasFilter
          ? db.rsvp.findMany({
              select: chairRsvpPartyCountsSelect,
              where: {},
            })
          : Promise.resolve(null),
      ]);

    const filteredTotals = sumChairRsvpPartyCounts(filteredPartyCounts);

    return {
      rsvps,
      pagination: buildPaginationState(pagination, totalCount),
      partyTotals: {
        overall: hasFilter
          ? sumChairRsvpPartyCounts(overallPartyCounts ?? filteredPartyCounts)
          : filteredTotals,
        filtered: hasFilter ? filteredTotals : null,
      } satisfies ChairRsvpHeaderTotals,
    };
  } catch {
    return {
      rsvps: [],
      pagination: buildPaginationState(pagination, 0),
      partyTotals: {
        overall: sumChairRsvpPartyCounts([]),
        filtered: null,
      } satisfies ChairRsvpHeaderTotals,
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

function formatRsvpStatus() {
  return "BBQ RSVP";
}

function formatHeaderMetaCount(
  overallCount: number,
  singularLabel: string,
  filteredCount: number | null,
) {
  const overallLabel = `${overallCount} ${singularLabel}${overallCount === 1 ? "" : "s"} overall`;

  if (filteredCount === null || filteredCount === overallCount) {
    return overallLabel;
  }

  return `${overallLabel} (${filteredCount} in selected filter)`;
}

function formatPartySummary(
  rsvp: Awaited<ReturnType<typeof getRsvps>>["rsvps"][number],
) {
  const partyCounts = getChairRsvpPartyCounts(rsvp);

  if (partyCounts) {
    return {
      primary: formatGuestSummary(
        partyCounts.adultAttendeeCount,
        partyCounts.childAttendeeCount,
      ),
      secondary:
        partyCounts.attendeeCount === 0
          ? undefined
          : formatAttendeeTotal(partyCounts.attendeeCount),
    };
  }

  const registration = rsvp.participant?.registrations[0];

  if (rsvp.source === "REGISTRATION" && registration) {
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
  await requireChairPageAuth("/chair/rsvps");

  const params = await searchParams;
  const paginationParams = parsePaginationParams(params);
  const rsvpFilter = parseRsvpFilter(params);
  const paginationSearchParams = pickSearchParams(params, [
    paginationParams.pageKey,
    paginationParams.pageSizeKey,
  ]);

  if (rsvpFilter) {
    paginationSearchParams[chairRsvpFilterParamKey] = rsvpFilter;
  }

  const { rsvps, pagination, partyTotals } = await getRsvps(
    paginationParams,
    rsvpFilter,
  );
  const rsvpSearchItems = rsvps.map((rsvp) => {
    const partySummary = formatPartySummary(rsvp);

    return {
      id: rsvp.id,
      searchText: joinSearchText([
        rsvp.firstName,
        rsvp.lastName,
        rsvp.email,
        formatRsvpStatus(),
        formatRsvpSource(rsvp.source),
        partySummary.primary,
        partySummary.secondary,
        rsvp.familyNames,
        rsvp.dietaryNotes,
        rsvp.notes,
      ]),
      filters: [
        `source:${rsvp.source}`,
        `attending:${rsvp.attending ? "yes" : "no"}`,
        rsvp.notes ? "notes:yes" : "notes:no",
      ],
    };
  });
  const rsvpFilters = [
    { value: "source:FORM", label: "RSVP form" },
    { value: "source:REGISTRATION", label: "Golf Registration" },
    { value: "notes:yes", label: "Has notes" },
    { value: "notes:no", label: "No notes" },
  ];

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
              {formatHeaderMetaCount(
                partyTotals.overall.adultAttendeeCount,
                "adult attendee",
                partyTotals.filtered?.adultAttendeeCount ?? null,
              )}
            </span>
            <span className={styles.pageMeta}>
              {formatHeaderMetaCount(
                partyTotals.overall.childAttendeeCount,
                "kid attendee",
                partyTotals.filtered?.childAttendeeCount ?? null,
              )}
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
        {rsvps.length === 0 ? (
          <section className={styles.panel}>
            <p className={styles.emptyState}>
              {pagination.isEmpty ? "No RSVPs yet." : "No RSVPs on this page."}
            </p>
          </section>
        ) : (
          <FilterableCardGrid
            emptyMessage="No RSVPs match this search on the current page."
            filterAllLabel="All RSVPs"
            filters={rsvpFilters}
            items={rsvpSearchItems}
            pagination={pagination}
            resultLabel="RSVPs"
            searchLabel="Search RSVPs"
            searchPlaceholder="Search names, emails, families, notes"
            urlBackedFilter={{
              value: rsvpFilter,
              searchParams: paginationSearchParams,
              filterParamKey: chairRsvpFilterParamKey,
              pageParamKey: paginationParams.pageKey,
            }}
          >
            {rsvps.map((rsvp) => {
              const partySummary = formatPartySummary(rsvp);
              const fullName = `${rsvp.firstName} ${rsvp.lastName}`;
              const statusLabel = formatRsvpStatus();
              const sourceLabel = formatRsvpSource(rsvp.source);

              return (
                <PreviewDetailCard
                  eyebrow="RSVP"
                  key={rsvp.id}
                  openLabel={`Open RSVP details for ${fullName}`}
                  preview={
                    <>
                      <p className={styles.cardKicker}>{sourceLabel}</p>
                      <h3 className={styles.cardTitle}>{fullName}</h3>
                      <p className={styles.cardMeta}>
                        {displayValue(rsvp.email)}
                      </p>
                      <div className={styles.cardMetaGrid}>
                        <span className={styles.metric}>
                          <span>Status</span>
                          <strong>{statusLabel}</strong>
                        </span>
                        <span className={styles.metric}>
                          <span>Party</span>
                          <strong>{partySummary.primary}</strong>
                        </span>
                      </div>
                      <p className={styles.cardText}>
                        {displayValue(rsvp.familyNames)}
                      </p>
                    </>
                  }
                  title={fullName}
                >
                  <div className={styles.detailGrid}>
                    <div className={styles.detailItem}>
                      <span>Email</span>
                      <p>{displayValue(rsvp.email)}</p>
                    </div>
                    <div className={styles.detailItem}>
                      <span>Status</span>
                      <p>{statusLabel}</p>
                    </div>
                    <div className={styles.detailItem}>
                      <span>Source</span>
                      <p>{sourceLabel}</p>
                    </div>
                    <div className={styles.detailItem}>
                      <span>Adult attendees</span>
                      <p>{displayValue(rsvp.adultAttendeeCount)}</p>
                    </div>
                    <div className={styles.detailItem}>
                      <span>Kid attendees</span>
                      <p>{displayValue(rsvp.childAttendeeCount)}</p>
                    </div>
                    <div className={styles.detailItem}>
                      <span>Total attendees</span>
                      <p>{rsvp.attendeeCount}</p>
                    </div>
                    <div className={styles.detailItem}>
                      <span>Party summary</span>
                      <p>
                        {partySummary.primary}
                        {partySummary.secondary
                          ? `\n${partySummary.secondary}`
                          : ""}
                      </p>
                    </div>
                    <div className={styles.detailItem}>
                      <span>Family</span>
                      <p>{displayValue(rsvp.familyNames)}</p>
                    </div>
                    <div className={styles.detailItem}>
                      <span>Dietary notes</span>
                      <p>{displayValue(rsvp.dietaryNotes)}</p>
                    </div>
                    <div className={styles.detailItem}>
                      <span>Notes</span>
                      <p>{displayValue(rsvp.notes)}</p>
                    </div>
                    <div className={styles.detailItem}>
                      <span>Received</span>
                      <p>{formatDateTime(rsvp.createdAt)}</p>
                    </div>
                  </div>
                </PreviewDetailCard>
              );
            })}
          </FilterableCardGrid>
        )}
      </section>
      <PaginationNav
        label="RSVPs"
        pagination={pagination}
        searchParams={paginationSearchParams}
      />
    </>
  );
}
