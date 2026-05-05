import styles from "@/app/chair/chair.module.css";
import { PaginationNav } from "@/components/PaginationNav";
import { db } from "@/lib/db";
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
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact</th>
                <th>Golf</th>
                <th>Package</th>
                <th>BBQ-only guests</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {registrations.length === 0 ? (
                <tr>
                  <td colSpan={6} className={styles.muted}>
                    {pagination.isEmpty
                      ? "No registrations yet."
                      : "No registrations on this page."}
                  </td>
                </tr>
              ) : (
                registrations.map((registration) => (
                  <tr key={registration.id}>
                    <td>
                      {registration.participant.firstName}{" "}
                      {registration.participant.lastName}
                    </td>
                    <td>
                      {registration.checkout?.email ??
                        registration.participant.email ??
                        ""}
                      <br />
                      {registration.participant.phone ?? ""}
                    </td>
                    <td>
                      {registration.participant.gender.replaceAll("_", " ")}
                      <br />
                      Age {registration.participant.age}, score{" "}
                      {registration.participant.averageScore}
                    </td>
                    <td>{registration.packageSelection}</td>
                    <td>
                      {formatGuestSummary(
                        registration.adultGuestCount,
                        registration.childGuestCount,
                      )}
                    </td>
                    <td>
                      <span className={styles.statusPill}>
                        {formatPaymentStatus(registration.paymentStatus)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      <PaginationNav
        label="Registrations"
        pagination={pagination}
        searchParams={params}
      />
    </>
  );
}
