import styles from "@/app/chair/chair.module.css";
import {
  displayValue,
  joinSearchText,
  uniqueFilterOptions,
} from "@/app/chair/display";
import { FilterableCardGrid } from "@/app/chair/FilterableCardGrid";
import { PreviewDetailCard } from "@/app/chair/PreviewDetailCard";
import { PaginationNav } from "@/components/PaginationNav";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import {
  buildPaginationState,
  parsePaginationParams,
  type PaginationParams,
  type SearchParamsRecord,
} from "@/lib/pagination";
import { Download } from "lucide-react";

export const dynamic = "force-dynamic";

type ChairRegistrationsPageProps = {
  searchParams: Promise<SearchParamsRecord>;
};

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

function formatBoolean(value: boolean) {
  return value ? "Yes" : "No";
}

async function getRegistrations(pagination: PaginationParams) {
  try {
    const [registrations, totalCount] = await Promise.all([
      db.registration.findMany({
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
      db.registration.count(),
    ]);

    return {
      registrations,
      pagination: buildPaginationState(pagination, totalCount),
    };
  } catch {
    return {
      registrations: [],
      pagination: buildPaginationState(pagination, 0),
    };
  }
}

export default async function ChairRegistrationsPage({
  searchParams,
}: ChairRegistrationsPageProps) {
  const params = await searchParams;
  const paginationParams = parsePaginationParams(params);
  const { registrations, pagination } =
    await getRegistrations(paginationParams);
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
    ...uniqueFilterOptions(
      registrations.map((registration) => ({
        value: `package:${registration.packageSelection}`,
        label: registration.packageSelection,
      })),
    ),
    { value: "gender:MALE", label: "Male golfers" },
    { value: "gender:FEMALE", label: "Female golfers" },
    { value: "gender:NON_BINARY", label: "Non-binary golfers" },
    { value: "gender:PREFER_NOT_TO_SAY", label: "Prefer not to say" },
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
              {pagination.totalCount} total registration
              {pagination.totalCount === 1 ? "" : "s"}
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
            resultLabel="registrations"
            searchLabel="Search registrations"
            searchPlaceholder="Search names, emails, packages, notes"
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
                  <div className={styles.detailGrid}>
                    <div className={styles.detailItem}>
                      <span>Contact email</span>
                      <p>{displayValue(contactEmail)}</p>
                    </div>
                    <div className={styles.detailItem}>
                      <span>Participant email</span>
                      <p>{displayValue(participant.email)}</p>
                    </div>
                    <div className={styles.detailItem}>
                      <span>Phone</span>
                      <p>{displayValue(participant.phone)}</p>
                    </div>
                    <div className={styles.detailItem}>
                      <span>Gender</span>
                      <p>{participant.gender.replaceAll("_", " ")}</p>
                    </div>
                    <div className={styles.detailItem}>
                      <span>Age</span>
                      <p>{participant.age}</p>
                    </div>
                    <div className={styles.detailItem}>
                      <span>Average score</span>
                      <p>{participant.averageScore}</p>
                    </div>
                    <div className={styles.detailItem}>
                      <span>Package</span>
                      <p>{registration.packageSelection}</p>
                    </div>
                    <div className={styles.detailItem}>
                      <span>BBQ adult guests</span>
                      <p>{registration.adultGuestCount}</p>
                    </div>
                    <div className={styles.detailItem}>
                      <span>BBQ kid guests</span>
                      <p>{registration.childGuestCount}</p>
                    </div>
                    <div className={styles.detailItem}>
                      <span>Day-before RSVP</span>
                      <p>{formatBoolean(registration.dayBeforeRsvp)}</p>
                    </div>
                    <div className={styles.detailItem}>
                      <span>Payment status</span>
                      <p>{paymentLabel}</p>
                    </div>
                    <div className={styles.detailItem}>
                      <span>Payment reference</span>
                      <p>{displayValue(registration.paymentReference)}</p>
                    </div>
                    <div className={styles.detailItem}>
                      <span>Created</span>
                      <p>{formatDateTime(registration.createdAt)}</p>
                    </div>
                    <div className={styles.detailItem}>
                      <span>Updated</span>
                      <p>{formatDateTime(registration.updatedAt)}</p>
                    </div>
                    <div className={styles.detailItem}>
                      <span>Notes</span>
                      <p>{displayValue(registration.notes)}</p>
                    </div>
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
        searchParams={params}
      />
    </>
  );
}
