import styles from "@/app/chair/chair.module.css";
import { displayValue, joinSearchText } from "@/app/chair/display";
import { FilterableCardGrid } from "@/app/chair/FilterableCardGrid";
import {
  parseChairListFilterParam,
  pickSearchParams,
} from "@/app/chair/listFiltering";
import { PreviewDetailCard } from "@/app/chair/PreviewDetailCard";
import {
  registrationAttendeeTotalsSelect,
  type ChairRegistrationsPageProps,
  type RegistrationAttendeeTotalsRow,
  type RegistrationGolferBreakdown,
  type RegistrationGuestBreakdown,
  type RegistrationHeaderSummary,
  type RegistrationHeaderTotals,
} from "@/app/chair/registrations/type";
import { PaginationNav } from "@/components/PaginationNav";
import { requireChairPageAuth } from "@/lib/chairAuth.server";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import {
  buildPaginationState,
  parsePaginationParams,
  type PaginationParams,
  type SearchParamsRecord,
} from "@/lib/pagination";
import type { PaymentStatus, Prisma } from "@prisma/client";
import { Download } from "lucide-react";

export const dynamic = "force-dynamic";

const registrationFilterParamKey = "filter";
const registrationPaymentStatuses = [
  "CONFIRMED",
  "WAIVED",
  "EXTERNAL_PENDING",
] as const;
const registrationGenders = [
  "MALE",
  "FEMALE"
] as const;

function parseRegistrationFilter(searchParams: SearchParamsRecord | undefined) {
  const filterValue = parseChairListFilterParam(
    searchParams,
    registrationFilterParamKey,
  );

  if (!filterValue) {
    return "";
  }

  if (filterValue.startsWith("payment:")) {
    const paymentStatus = filterValue
      .slice("payment:".length)
      .trim()
      .toUpperCase();

    return registrationPaymentStatuses.includes(
      paymentStatus as (typeof registrationPaymentStatuses)[number],
    )
      ? `payment:${paymentStatus}`
      : "";
  }

  if (filterValue.startsWith("package:")) {
    const packageSelection = filterValue.slice("package:".length).trim();

    return packageSelection ? `package:${packageSelection}` : "";
  }

  if (filterValue.startsWith("gender:")) {
    const gender = filterValue.slice("gender:".length).trim().toUpperCase();

    return registrationGenders.includes(
      gender as (typeof registrationGenders)[number],
    )
      ? `gender:${gender}`
      : "";
  }

  return "";
}

function buildRegistrationWhere(
  filterValue: string,
): Prisma.RegistrationWhereInput {
  if (!filterValue) {
    return {};
  }

  if (filterValue.startsWith("payment:")) {
    return {
      paymentStatus: filterValue.slice("payment:".length) as PaymentStatus,
    };
  }

  if (filterValue.startsWith("package:")) {
    return {
      packageSelection: {
        equals: filterValue.slice("package:".length),
        mode: "insensitive",
      },
    };
  }

  return {
    participant: {
      gender: filterValue.slice(
        "gender:".length,
      ) as (typeof registrationGenders)[number],
    },
  };
}

function formatGuestSummary(adultGuestCount: number, childGuestCount: number) {
  if (adultGuestCount === 0 && childGuestCount === 0) {
    return "None";
  }

  const parts = [];

  if (adultGuestCount > 0) {
    parts.push(
      `${adultGuestCount} BBQ adult${adultGuestCount === 1 ? "" : "s"}`,
    );
  }

  if (childGuestCount > 0) {
    parts.push(`${childGuestCount} BBQ kid${childGuestCount === 1 ? "" : "s"}`);
  }

  return parts.join(", ");
}

function formatPaymentStatus(paymentStatus: string) {
  if (paymentStatus === "EXTERNAL_PENDING") {
    return "Pending payment";
  }

  if (paymentStatus === "CONFIRMED") {
    return "Complete";
  }

  if (paymentStatus === "WAIVED") {
    return "Complete (waived)";
  }

  return paymentStatus.replaceAll("_", " ");
}

function sumRegistrationAttendeeTotals(
  registrations: ReadonlyArray<RegistrationAttendeeTotalsRow>,
) {
  return registrations.reduce<Omit<RegistrationHeaderTotals, "totalCount">>(
    (totals, registration) => {
      const registrantIsAdult = registration.participant.age >= 15;

      totals.guests.adultCount += registration.adultGuestCount;
      totals.guests.childCount += registration.childGuestCount;
      totals.guests.totalCount +=
        registration.adultGuestCount + registration.childGuestCount;

      if (registration.participant.gender === "MALE") {
        if (registrantIsAdult) {
          totals.golfers.maleAdultCount += 1;
        } else {
          totals.golfers.maleChildCount += 1;
        }

        return totals;
      }

      if (registration.participant.gender === "FEMALE") {
        if (registrantIsAdult) {
          totals.golfers.femaleAdultCount += 1;
        } else {
          totals.golfers.femaleChildCount += 1;
        }

        return totals;
      }

      if (registrantIsAdult) {
        totals.golfers.otherAdultCount += 1;
      } else {
        totals.golfers.otherChildCount += 1;
      }

      return totals;
    },
    {
      golfers: {
        maleAdultCount: 0,
        femaleAdultCount: 0,
        otherAdultCount: 0,
        maleChildCount: 0,
        femaleChildCount: 0,
        otherChildCount: 0,
      },
      guests: {
        totalCount: 0,
        adultCount: 0,
        childCount: 0,
      },
    },
  );
}

function buildRegistrationHeaderTotals(
  totalCount: number,
  registrations: ReadonlyArray<RegistrationAttendeeTotalsRow>,
): RegistrationHeaderTotals {
  return {
    totalCount,
    ...sumRegistrationAttendeeTotals(registrations),
  };
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

function formatHeaderMetaSummary(
  label: string,
  overallSummary: string,
  filteredSummary: string | null,
) {
  if (filteredSummary === null || filteredSummary === overallSummary) {
    return `${label} overall: ${overallSummary}`;
  }

  return `${label} overall: ${overallSummary} (selected filter: ${filteredSummary})`;
}

function formatAdultGolferBreakdown(golfers: RegistrationGolferBreakdown) {
  const parts = [
    `${golfers.maleAdultCount} male`,
    `${golfers.femaleAdultCount} female`,
  ];

  if (golfers.otherAdultCount > 0) {
    parts.push(`${golfers.otherAdultCount} other/unspecified`);
  }

  return parts.join(", ");
}

function formatKidGolferBreakdown(golfers: RegistrationGolferBreakdown) {
  const parts = [
    `${golfers.maleChildCount} male`,
    `${golfers.femaleChildCount} female`,
  ];

  if (golfers.otherChildCount > 0) {
    parts.push(`${golfers.otherChildCount} other/unspecified`);
  }

  return parts.join(", ");
}

function formatGuestBreakdown(guests: RegistrationGuestBreakdown) {
  return `${guests.totalCount} total, ${guests.adultCount} adult${guests.adultCount === 1 ? "" : "s"}, ${guests.childCount} kid${guests.childCount === 1 ? "" : "s"}`;
}

async function getRegistrations(
  pagination: PaginationParams,
  filterValue: string,
) {
  const registrationWhere = buildRegistrationWhere(filterValue);
  const hasFilter = Boolean(filterValue);

  try {
    const [
      registrations,
      filteredTotalCount,
      filteredAttendeeRows,
      overallTotalCount,
      overallAttendeeRows,
    ] = await Promise.all([
      db.registration.findMany({
        where: registrationWhere,
        include: {
          checkout: {
            select: {
              email: true,
            },
          },
          participant: true,
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: pagination.skip,
        take: pagination.take,
      }),
      db.registration.count({ where: registrationWhere }),
      db.registration.findMany({
        select: registrationAttendeeTotalsSelect,
        where: registrationWhere,
      }),
      hasFilter ? db.registration.count({ where: {} }) : Promise.resolve(null),
      hasFilter
        ? db.registration.findMany({
            select: registrationAttendeeTotalsSelect,
            where: {},
          })
        : Promise.resolve(null),
    ]);

    const filteredHeaderTotals = buildRegistrationHeaderTotals(
      filteredTotalCount,
      filteredAttendeeRows,
    );

    return {
      registrations,
      pagination: buildPaginationState(pagination, filteredTotalCount),
      headerTotals: {
        overall: hasFilter
          ? buildRegistrationHeaderTotals(
              overallTotalCount ?? filteredTotalCount,
              overallAttendeeRows ?? filteredAttendeeRows,
            )
          : filteredHeaderTotals,
        filtered: hasFilter ? filteredHeaderTotals : null,
      } satisfies RegistrationHeaderSummary,
    };
  } catch {
    const emptyHeaderTotals = buildRegistrationHeaderTotals(0, []);

    return {
      registrations: [],
      pagination: buildPaginationState(pagination, 0),
      headerTotals: {
        overall: emptyHeaderTotals,
        filtered: null,
      } satisfies RegistrationHeaderSummary,
    };
  }
}

export default async function ChairRegistrationsPage({
  searchParams,
}: ChairRegistrationsPageProps) {
  await requireChairPageAuth("/chair/registrations");

  const params = await searchParams;
  const paginationParams = parsePaginationParams(params);
  const registrationFilter = parseRegistrationFilter(params);
  const paginationSearchParams = pickSearchParams(params, [
    paginationParams.pageKey,
    paginationParams.pageSizeKey,
  ]);

  if (registrationFilter) {
    paginationSearchParams[registrationFilterParamKey] = registrationFilter;
  }

  const { registrations, pagination, headerTotals } = await getRegistrations(
    paginationParams,
    registrationFilter,
  );
  const registrationSearchItems = registrations.map((registration) => {
    const participant = registration.participant;
    const paymentLabel = formatPaymentStatus(registration.paymentStatus);

    return {
      id: registration.id,
      searchText: joinSearchText([
        participant.firstName,
        participant.lastName,
        participant.email,
        participant.phone,
        participant.gender,
        participant.age,
        participant.averageScore,
        registration.checkout?.email,
        registration.packageSelection,
        paymentLabel,
        registration.paymentReference,
        registration.notes,
      ]),
      filters: [
        `payment:${registration.paymentStatus}`,
        `package:${registration.packageSelection}`,
        `gender:${participant.gender}`,
      ],
    };
  });
  const registrationFilters = [
    { value: "payment:CONFIRMED", label: "Complete" },
    { value: "payment:WAIVED", label: "Complete (waived)" },
    { value: "payment:EXTERNAL_PENDING", label: "Pending payment" },
    { value: "gender:MALE", label: "Male golfers" },
    { value: "gender:FEMALE", label: "Female golfers" },
  ];

  return (
    <>
      <div className={styles.topline}>
        <div className={styles.pageHeaderCopy}>
          <p className="eyebrow">Private</p>
          <h1>Registrations</h1>
          <p className={styles.pageIntro}>
            Review golf and BBQ registrations, confirm guest counts, and export
            the full chair dataset when you need it offline.
          </p>
          <div className={styles.pageMetaBar}>
            <span className={styles.pageMeta}>
              {formatHeaderMetaCount(
                headerTotals.overall.totalCount,
                "registration",
                headerTotals.filtered?.totalCount ?? null,
              )}
            </span>
            <span className={styles.pageMeta}>
              {formatHeaderMetaSummary(
                "Adult golfers",
                formatAdultGolferBreakdown(headerTotals.overall.golfers),
                headerTotals.filtered
                  ? formatAdultGolferBreakdown(headerTotals.filtered.golfers)
                  : null,
              )}
            </span>
            <span className={styles.pageMeta}>
              {formatHeaderMetaSummary(
                "Kid golfers",
                formatKidGolferBreakdown(headerTotals.overall.golfers),
                headerTotals.filtered
                  ? formatKidGolferBreakdown(headerTotals.filtered.golfers)
                  : null,
              )}
            </span>
            <span className={styles.pageMeta}>
              {formatHeaderMetaSummary(
                "Guests",
                formatGuestBreakdown(headerTotals.overall.guests),
                headerTotals.filtered
                  ? formatGuestBreakdown(headerTotals.filtered.guests)
                  : null,
              )}
            </span>
          </div>
        </div>
        <div className={styles.actions}>
          <a
            className={styles.actionButton}
            download
            href="/api/chair/registrations/export"
          >
            <Download aria-hidden="true" size={16} />
            Export CSV
          </a>
          <a
            className={styles.actionButton}
            download
            href="/api/chair/registrations/export?scope=golfers"
          >
            <Download aria-hidden="true" size={16} />
            Export golfers CSV
          </a>
        </div>
      </div>
      <section className={styles.sectionBlock}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionHeading}>
            <h2 className={styles.sectionTitle}>Current registrations</h2>
            <p className={styles.sectionIntro}>
              Package choice, golfer details, guest counts, and payment state.
              CSV exports always include the full dataset, not just the current
              page.
            </p>
          </div>
        </div>
        {registrations.length === 0 ? (
          <section className={styles.panel}>
            <p className={styles.emptyState}>
              {pagination.isEmpty
                ? "No registrations yet."
                : "No registrations on this page."}
            </p>
          </section>
        ) : (
          <FilterableCardGrid
            emptyMessage="No registrations match this search on the current page."
            filterAllLabel="All registrations"
            filters={registrationFilters}
            items={registrationSearchItems}
            pagination={pagination}
            resultLabel="registrations"
            searchLabel="Search registrations"
            searchPlaceholder="Search names, emails, packages, notes"
            urlBackedFilter={{
              value: registrationFilter,
              searchParams: paginationSearchParams,
              filterParamKey: registrationFilterParamKey,
              pageParamKey: paginationParams.pageKey,
            }}
          >
            {registrations.map((registration) => {
              const participant = registration.participant;
              const fullName = `${participant.firstName} ${participant.lastName}`;
              const paymentLabel = formatPaymentStatus(
                registration.paymentStatus,
              );
              const contactEmail =
                registration.checkout?.email ?? participant.email;
              const guestSummary = formatGuestSummary(
                registration.adultGuestCount,
                registration.childGuestCount,
              );

              return (
                <PreviewDetailCard
                  eyebrow="Registration"
                  key={registration.id}
                  openLabel={`Open registration details for ${fullName}`}
                  preview={
                    <>
                      <p className={styles.cardKicker}>{paymentLabel}</p>
                      <h3 className={styles.cardTitle}>{fullName}</h3>
                      <p className={styles.cardMeta}>
                        {displayValue(contactEmail)}
                        <br />
                        {displayValue(participant.phone)}
                      </p>
                      <div className={styles.cardMetaGrid}>
                        <span className={styles.metric}>
                          <span>Package</span>
                          <strong>{registration.packageSelection}</strong>
                        </span>
                        <span className={styles.metric}>
                          <span>Guests</span>
                          <strong>{guestSummary}</strong>
                        </span>
                      </div>
                    </>
                  }
                  title={fullName}
                >
                  <div className={styles.detailSectionGrid}>
                    <section className={styles.detailSection}>
                      <div className={styles.detailSectionHeader}>
                        <h3 className={styles.detailSectionTitle}>Attendee</h3>
                        <p className={styles.detailSectionIntro}>
                          Contact information and golfer profile.
                        </p>
                      </div>
                      <dl className={styles.detailRows}>
                        <div className={styles.detailRow}>
                          <dt className={styles.detailRowLabel}>
                            Contact email
                          </dt>
                          <dd className={styles.detailRowValue}>
                            {displayValue(contactEmail)}
                          </dd>
                        </div>
                        <div className={styles.detailRow}>
                          <dt className={styles.detailRowLabel}>Phone</dt>
                          <dd className={styles.detailRowValue}>
                            {displayValue(participant.phone)}
                          </dd>
                        </div>
                        <div className={styles.detailRow}>
                          <dt className={styles.detailRowLabel}>Gender</dt>
                          <dd className={styles.detailRowValue}>
                            {participant.gender.replaceAll("_", " ")}
                          </dd>
                        </div>
                        <div className={styles.detailRow}>
                          <dt className={styles.detailRowLabel}>Age</dt>
                          <dd className={styles.detailRowValue}>
                            {participant.age}
                          </dd>
                        </div>
                        <div className={styles.detailRow}>
                          <dt className={styles.detailRowLabel}>
                            Average score
                          </dt>
                          <dd className={styles.detailRowValue}>
                            {participant.averageScore}
                          </dd>
                        </div>
                      </dl>
                    </section>
                    <section className={styles.detailSection}>
                      <div className={styles.detailSectionHeader}>
                        <h3 className={styles.detailSectionTitle}>
                          Registration
                        </h3>
                        <p className={styles.detailSectionIntro}>
                          Package selection and guest counts tied to this entry.
                        </p>
                      </div>
                      <dl className={styles.detailRows}>
                        <div className={styles.detailRow}>
                          <dt className={styles.detailRowLabel}>Package</dt>
                          <dd className={styles.detailRowValue}>
                            {registration.packageSelection}
                          </dd>
                        </div>
                        <div className={styles.detailRow}>
                          <dt className={styles.detailRowLabel}>
                            Guest summary
                          </dt>
                          <dd className={styles.detailRowValue}>
                            {guestSummary}
                          </dd>
                        </div>
                        <div className={styles.detailRow}>
                          <dt className={styles.detailRowLabel}>
                            BBQ adult guests
                          </dt>
                          <dd className={styles.detailRowValue}>
                            {registration.adultGuestCount}
                          </dd>
                        </div>
                        <div className={styles.detailRow}>
                          <dt className={styles.detailRowLabel}>
                            BBQ kid guests
                          </dt>
                          <dd className={styles.detailRowValue}>
                            {registration.childGuestCount}
                          </dd>
                        </div>
                      </dl>
                    </section>
                    <section className={styles.detailSection}>
                      <div className={styles.detailSectionHeader}>
                        <h3 className={styles.detailSectionTitle}>Payment</h3>
                        <p className={styles.detailSectionIntro}>
                          Checkout status and saved reference for chair review.
                        </p>
                      </div>
                      <dl className={styles.detailRows}>
                        <div className={styles.detailRow}>
                          <dt className={styles.detailRowLabel}>
                            Payment status
                          </dt>
                          <dd className={styles.detailRowValue}>
                            {paymentLabel}
                          </dd>
                        </div>
                        <div className={styles.detailRow}>
                          <dt className={styles.detailRowLabel}>
                            Payment reference
                          </dt>
                          <dd className={styles.detailRowValue}>
                            {displayValue(registration.paymentReference)}
                          </dd>
                        </div>
                        <div className={styles.detailRow}>
                          <dt className={styles.detailRowLabel}>Created</dt>
                          <dd className={styles.detailRowValue}>
                            {formatDateTime(registration.createdAt)}
                          </dd>
                        </div>
                        <div className={styles.detailRow}>
                          <dt className={styles.detailRowLabel}>Updated</dt>
                          <dd className={styles.detailRowValue}>
                            {formatDateTime(registration.updatedAt)}
                          </dd>
                        </div>
                      </dl>
                    </section>
                    <section
                      className={`${styles.detailSection} ${styles.detailSectionWide}`}
                    >
                      <div className={styles.detailSectionHeader}>
                        <h3 className={styles.detailSectionTitle}>Notes</h3>
                        <p className={styles.detailSectionIntro}>
                          Freeform context captured with this registration.
                        </p>
                      </div>
                      <div className={styles.detailNotePanel}>
                        <p>{displayValue(registration.notes)}</p>
                      </div>
                    </section>
                  </div>
                </PreviewDetailCard>
              );
            })}
          </FilterableCardGrid>
        )}
      </section>
      <PaginationNav
        label="Registrations"
        pagination={pagination}
        searchParams={paginationSearchParams}
      />
    </>
  );
}
