import {
  generatePairings,
  publishPairings,
  updatePairingGroup,
} from "@/app/actions/pairings";
import styles from "@/app/chair/chair.module.css";
import { PaginationNav } from "@/components/PaginationNav";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import {
  buildPaginationState,
  parsePaginationParams,
  type PaginationParams,
  type SearchParamsRecord,
} from "@/lib/pagination";

export const dynamic = "force-dynamic";

type ChairPairingsPageProps = {
  searchParams: Promise<SearchParamsRecord>;
};

function datetimeLocalValue(value: Date | null) {
  if (!value) {
    return "";
  }

  const offsetMs = value.getTimezoneOffset() * 60 * 1000;
  return new Date(value.getTime() - offsetMs).toISOString().slice(0, 16);
}

async function getPairings(pagination: PaginationParams) {
  try {
    const [groups, totalCount, participantCount, draftCount] =
      await Promise.all([
        db.pairingGroup.findMany({
          include: {
            members: {
              include: { participant: true },
              orderBy: { slot: "asc" },
            },
          },
          orderBy: [{ status: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
          skip: pagination.skip,
          take: pagination.take,
        }),
        db.pairingGroup.count(),
        db.participant.count({
          where: {
            registrations: {
              some: {},
            },
          },
        }),
        db.pairingGroup.count({
          where: {
            status: "DRAFT",
          },
        }),
      ]);

    return {
      groups,
      participantCount,
      draftCount,
      pagination: buildPaginationState(pagination, totalCount),
    };
  } catch {
    return {
      groups: [],
      participantCount: 0,
      draftCount: 0,
      pagination: buildPaginationState(pagination, 0),
    };
  }
}

export default async function ChairPairingsPage({
  searchParams,
}: ChairPairingsPageProps) {
  const params = await searchParams;
  const paginationParams = parsePaginationParams(params);
  const { groups, participantCount, draftCount, pagination } =
    await getPairings(paginationParams);

  return (
    <>
      <div className={styles.topline}>
        <div className={styles.pageHeaderCopy}>
          <p className="eyebrow">Private</p>
          <h1>Pairings</h1>
          <p className={styles.pageIntro}>
            Generate a deterministic draft, tune each group in place, and
            publish only when tee times and ordering are ready for the public
            site.
          </p>
          <div className={styles.pageMetaBar}>
            <span className={styles.pageMeta}>
              {participantCount} participant{participantCount === 1 ? "" : "s"}{" "}
              available
            </span>
            <span className={styles.pageMeta}>
              {draftCount} draft group{draftCount === 1 ? "" : "s"}
            </span>
            <span className={styles.pageMeta}>
              {pagination.totalCount} total group
              {pagination.totalCount === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        <div className={styles.actions}>
          <form action={generatePairings}>
            <button className={styles.actionButton} type="submit">
              Generate draft
            </button>
          </form>
          <form action={publishPairings}>
            <button
              className={styles.actionButton}
              disabled={!draftCount}
              type="submit"
            >
              Publish draft
            </button>
          </form>
        </div>
      </div>
      <section className={styles.sectionBlock}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionHeading}>
            <h2 className={styles.sectionTitle}>Pairing groups</h2>
            <p className={styles.sectionIntro}>
              Draft groups appear before published ones. Update the name, order,
              or tee time in place, then review the member list before you
              publish.
            </p>
          </div>
        </div>
        <section className={styles.pairingGrid}>
          {groups.length === 0 ? (
            <div className={styles.panel}>
              <p className={styles.emptyState}>
                {pagination.isEmpty
                  ? "Pairings will appear here after you generate a draft."
                  : "No pairing groups on this page."}
              </p>
            </div>
          ) : (
            groups.map((group) => (
              <article className={styles.panel} key={group.id}>
                <form
                  action={updatePairingGroup}
                  className={styles.compactForm}
                >
                  <input name="id" type="hidden" value={group.id} />
                  <label>
                    Name
                    <input
                      name="name"
                      required
                      type="text"
                      defaultValue={group.name}
                    />
                  </label>
                  <label>
                    Sort order
                    <input
                      min="1"
                      name="sortOrder"
                      required
                      type="number"
                      defaultValue={group.sortOrder}
                    />
                  </label>
                  <label>
                    Tee time
                    <input
                      required
                      name="teeTime"
                      type="datetime-local"
                      defaultValue={datetimeLocalValue(group.teeTime)}
                    />
                  </label>
                  <button className={styles.actionButton} type="submit">
                    Save group
                  </button>
                </form>
                <p className={styles.muted}>
                  <span className={styles.statusPill}>{group.status}</span> ·{" "}
                  {formatDateTime(group.teeTime)}
                </p>
                <ul className={styles.pairingMembers}>
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
            ))
          )}
        </section>
      </section>
      <PaginationNav
        label="Pairing groups"
        pagination={pagination}
        searchParams={params}
      />
    </>
  );
}
