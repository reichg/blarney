import {
  createPairingGroup,
  generatePairings,
  publishPairings,
  unpublishPairings,
} from "@/app/actions/pairings";
import styles from "@/app/chair/chair.module.css";
import { joinSearchText } from "@/app/chair/display";
import { FilterableCardGrid } from "@/app/chair/FilterableCardGrid";
import {
  filterChairListItems,
  parseChairListFilterParam,
  pickSearchParams,
  type ChairListSearchItem,
} from "@/app/chair/listFiltering";
import { PairingGolferCard } from "@/app/chair/pairings/PairingGolferCard";
import { PairingGroupCard } from "@/app/chair/pairings/PairingGroupCard";
import {
  type ChairPairingsPageProps,
  type GolferAssignment,
  type PairingGroupWithMembers,
  type PairingNotice,
} from "@/app/chair/pairings/type";
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
import { sortPairingGolfers } from "@/lib/pairings";
import { completeRegistrationPaymentStatuses } from "@/lib/payment";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const chairPairingsPath = "/chair/pairings";
const unassignedFilterParamKey = "unassignedFilter";
const draftFilterParamKey = "draftFilter";
const publishedFilterParamKey = "publishedFilter";
const golferFilters = [
  { value: "gender:MALE", label: "Male golfers" },
  { value: "gender:FEMALE", label: "Female golfers" },
] as const;
const groupFilters = [
  { value: "tee:yes", label: "Has tee time" },
  { value: "tee:no", label: "No tee time" },
  { value: "capacity:full", label: "Full groups" },
  { value: "capacity:open", label: "Open groups" },
] as const;

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseAllowlistedPairingsFilter(
  searchParams: SearchParamsRecord | undefined,
  filterKey: string,
  allowedValues: readonly string[],
) {
  const filterValue = parseChairListFilterParam(searchParams, filterKey);

  if (!filterValue) {
    return "";
  }

  return (
    allowedValues.find(
      (allowedValue) =>
        allowedValue.toLowerCase() === filterValue.toLowerCase(),
    ) ?? ""
  );
}

function getPairingNotice(
  value: string | string[] | undefined,
): PairingNotice | null {
  switch (getParam(value)) {
    case "unpublished":
      return {
        tone: "success",
        title: "Published groups moved back to draft.",
        body: "You can edit group names, tee times, sort order, and golfer assignments again before publishing a new live set.",
      };
    case "unpublish-conflict":
      return {
        tone: "error",
        title: "Unpublish blocked while a draft set already exists.",
        body: "Publish or clear the current draft groups before moving the live groups back to draft.",
      };
    case "unpublish-error":
      return {
        tone: "error",
        title: "Unpublish did not finish.",
        body: "Reload and try again. If another draft was created in the meantime, clear or publish it first.",
      };
    default:
      return null;
  }
}

async function submitUnpublishPairings() {
  "use server";

  try {
    await unpublishPairings();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const notice = message.includes("draft pairings already exist")
      ? "unpublish-conflict"
      : "unpublish-error";

    redirect(`${chairPairingsPath}?pairings=${notice}`);
  }

  redirect(`${chairPairingsPath}?pairings=unpublished`);
}

function buildGroupSearchText(group: PairingGroupWithMembers) {
  return joinSearchText([
    group.name,
    group.status,
    group.sortOrder,
    group.teeTime ? formatDateTime(group.teeTime) : null,
    ...group.members.flatMap((member) => [
      member.participant.firstName,
      member.participant.lastName,
      member.snapshotAge,
      member.snapshotGender,
      member.snapshotScore,
    ]),
  ]);
}

function buildGroupFilters(group: PairingGroupWithMembers) {
  return [
    `status:${group.status}`,
    group.teeTime ? "tee:yes" : "tee:no",
    group.members.length >= 4 ? "capacity:full" : "capacity:open",
  ];
}

function filterAndPaginatePairingsList<T extends { id: string }>(
  records: T[],
  items: ChairListSearchItem[],
  filterValue: string,
  paginationParams: PaginationParams,
) {
  const filteredItems = filterChairListItems(items, "", filterValue);
  const filteredIds = new Set(filteredItems.map((item) => item.id));
  const filteredRecords = records.filter((record) =>
    filteredIds.has(record.id),
  );
  const totalPages =
    filteredRecords.length === 0
      ? 1
      : Math.ceil(filteredRecords.length / paginationParams.pageSize);
  const effectivePage = Math.min(paginationParams.page, totalPages);
  const effectiveParams =
    effectivePage === paginationParams.page
      ? paginationParams
      : {
          ...paginationParams,
          page: effectivePage,
          skip: (effectivePage - 1) * paginationParams.pageSize,
          take: paginationParams.pageSize,
        };
  const pagination = buildPaginationState(
    effectiveParams,
    filteredRecords.length,
  );
  const pagedRecords = filteredRecords.slice(
    effectiveParams.skip,
    effectiveParams.skip + effectiveParams.take,
  );
  const pagedIds = new Set(pagedRecords.map((record) => record.id));
  const pagedItems = filteredItems.filter((item) => pagedIds.has(item.id));

  return {
    items: pagedItems,
    pagination,
    records: pagedRecords,
  };
}

async function getPairingData() {
  try {
    const [draftGroups, publishedGroups, paidGolfers] = await Promise.all([
      db.pairingGroup.findMany({
        where: { status: "DRAFT" },
        include: {
          members: {
            include: { participant: true },
            orderBy: { slot: "asc" },
          },
        },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      }),
      db.pairingGroup.findMany({
        where: { status: "PUBLISHED" },
        include: {
          members: {
            include: { participant: true },
            orderBy: { slot: "asc" },
          },
        },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      }),
      db.participant.findMany({
        where: {
          registrations: {
            some: {
              paymentStatus: {
                in: [...completeRegistrationPaymentStatuses],
              },
            },
          },
        },
        include: {
          registrations: {
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            select: {
              notes: true,
            },
            take: 1,
          },
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
    ]);

    const assignmentByParticipantId = new Map<string, GolferAssignment>();

    for (const group of draftGroups) {
      for (const member of group.members) {
        assignmentByParticipantId.set(member.participantId, {
          groupId: group.id,
          groupName: group.name,
        });
      }
    }

    const golfers = paidGolfers.map((participant) => ({
      ...participant,
      pairingNote: participant.registrations[0]?.notes?.trim() || null,
      draftAssignment: assignmentByParticipantId.get(participant.id) ?? null,
    }));

    const unassignedGolfers = sortPairingGolfers(
      golfers.filter((participant) => !participant.draftAssignment),
    );
    const unassignedGolferCount = unassignedGolfers.length;

    const nextSortOrder =
      draftGroups.length > 0
        ? Math.max(...draftGroups.map((g) => g.sortOrder)) + 1
        : publishedGroups.length > 0
          ? Math.max(...publishedGroups.map((g) => g.sortOrder)) + 1
          : 1;

    return {
      draftGroups,
      publishedGroups,
      unassignedGolfers,
      paidGolferCount: paidGolfers.length,
      nextSortOrder,
      unassignedGolferCount,
    };
  } catch {
    return {
      draftGroups: [],
      publishedGroups: [],
      unassignedGolfers: [],
      paidGolferCount: 0,
      nextSortOrder: 1,
      unassignedGolferCount: 0,
    };
  }
}

export default async function ChairPairingsPage({
  searchParams,
}: ChairPairingsPageProps) {
  await requireChairPageAuth(chairPairingsPath);

  const params = (await searchParams) ?? {};
  const unassignedPaginationParams = parsePaginationParams(params, {
    pageKey: "unassignedPage",
    pageSizeKey: "unassignedPageSize",
  });
  const draftPaginationParams = parsePaginationParams(params, {
    pageKey: "draftPage",
    pageSizeKey: "draftPageSize",
  });
  const publishedPaginationParams = parsePaginationParams(params, {
    pageKey: "publishedPage",
    pageSizeKey: "publishedPageSize",
  });
  const unassignedFilter = parseAllowlistedPairingsFilter(
    params,
    unassignedFilterParamKey,
    golferFilters.map((filter) => filter.value),
  );
  const draftFilter = parseAllowlistedPairingsFilter(
    params,
    draftFilterParamKey,
    groupFilters.map((filter) => filter.value),
  );
  const publishedFilter = parseAllowlistedPairingsFilter(
    params,
    publishedFilterParamKey,
    groupFilters.map((filter) => filter.value),
  );
  const pairingsSearchParams = pickSearchParams(params, [
    unassignedPaginationParams.pageKey,
    unassignedPaginationParams.pageSizeKey,
    draftPaginationParams.pageKey,
    draftPaginationParams.pageSizeKey,
    publishedPaginationParams.pageKey,
    publishedPaginationParams.pageSizeKey,
    unassignedFilterParamKey,
    draftFilterParamKey,
    publishedFilterParamKey,
  ]);

  if (unassignedFilter) {
    pairingsSearchParams[unassignedFilterParamKey] = unassignedFilter;
  }

  if (draftFilter) {
    pairingsSearchParams[draftFilterParamKey] = draftFilter;
  }

  if (publishedFilter) {
    pairingsSearchParams[publishedFilterParamKey] = publishedFilter;
  }

  const pairingNotice = getPairingNotice(params.pairings);
  const {
    draftGroups,
    publishedGroups,
    unassignedGolfers,
    paidGolferCount,
    nextSortOrder,
    unassignedGolferCount,
  } = await getPairingData();
  const golferSearchItems = unassignedGolfers.map((golfer) => ({
    id: golfer.id,
    searchText: joinSearchText([
      golfer.firstName,
      golfer.lastName,
      golfer.age,
      golfer.gender,
      golfer.averageScore,
    ]),
    filters: [`gender:${golfer.gender}`],
  }));
  const draftGroupSearchItems = draftGroups.map((group) => ({
    id: group.id,
    searchText: buildGroupSearchText(group),
    filters: buildGroupFilters(group),
  }));
  const publishedGroupSearchItems = publishedGroups.map((group) => ({
    id: group.id,
    searchText: buildGroupSearchText(group),
    filters: buildGroupFilters(group),
  }));
  const pagedUnassignedGolfers = filterAndPaginatePairingsList(
    unassignedGolfers,
    golferSearchItems,
    unassignedFilter,
    unassignedPaginationParams,
  );
  const pagedDraftGroups = filterAndPaginatePairingsList(
    draftGroups,
    draftGroupSearchItems,
    draftFilter,
    draftPaginationParams,
  );
  const pagedPublishedGroups = filterAndPaginatePairingsList(
    publishedGroups,
    publishedGroupSearchItems,
    publishedFilter,
    publishedPaginationParams,
  );

  return (
    <>
      <div className={styles.topline}>
        <div className={styles.pageHeaderCopy}>
          <p className="eyebrow">Private</p>
          <h1>Pairings</h1>
          <p className={styles.pageIntro}>
            Generate neutral draft groups that aim for at least one female when
            possible, one older-player anchor per group, a balanced mix of
            lower- and higher-scoring golfers, and group scores that stay as
            even as possible across the board. Publish when tee times and
            ordering are ready.
          </p>
          <div className={styles.pageMetaBar}>
            <span className={styles.pageMeta}>
              {paidGolferCount} paid golfer{paidGolferCount === 1 ? "" : "s"}
            </span>
            <span className={styles.pageMeta}>
              {unassignedGolferCount} unassigned
            </span>
            <span className={styles.pageMeta}>
              {draftGroups.length} draft group
              {draftGroups.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        <div className={styles.actions}>
          <form action={generatePairings}>
            <button className={styles.actionButton} type="submit">
              Generate draft groups
            </button>
          </form>
          <form action={publishPairings}>
            <button
              className={styles.actionButton}
              disabled={draftGroups.length === 0}
              type="submit"
            >
              Publish draft
            </button>
          </form>
        </div>
      </div>

      {pairingNotice ? (
        <section
          aria-live="polite"
          className={`${styles.panel} ${styles.pairingNotice} ${
            pairingNotice.tone === "error"
              ? styles.pairingNoticeError
              : styles.pairingNoticeSuccess
          }`}
          role={pairingNotice.tone === "error" ? "alert" : "status"}
        >
          <p className={styles.pairingNoticeTitle}>{pairingNotice.title}</p>
          <p className={styles.pairingNoticeBody}>{pairingNotice.body}</p>
        </section>
      ) : null}

      <section className={styles.sectionBlock}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionHeading}>
            <h2 className={styles.sectionTitle}>Golfers</h2>
            <p className={styles.sectionIntro}>
              Paid golfers who are still available to assign to a draft group.
              Unassigned golfers are ordered by gender, then score, then age.
            </p>
          </div>
        </div>
        {unassignedGolfers.length === 0 ? (
          <section className={styles.panel}>
            <p className={styles.emptyState}>
              No unassigned paid golfers are ready for pairings.
            </p>
          </section>
        ) : (
          <>
            <FilterableCardGrid
              className={styles.compactCardGrid}
              emptyMessage="No unassigned golfers match this search on the current page."
              filterAllLabel="All unassigned golfers"
              filters={golferFilters}
              items={pagedUnassignedGolfers.items}
              pagination={pagedUnassignedGolfers.pagination}
              resultLabel="unassigned golfers"
              searchLabel="Search unassigned golfers"
              searchPlaceholder="Search names, scores, genders"
              urlBackedFilter={{
                value: unassignedFilter,
                searchParams: pairingsSearchParams,
                filterParamKey: unassignedFilterParamKey,
                pageParamKey: unassignedPaginationParams.pageKey,
              }}
            >
              {pagedUnassignedGolfers.records.map((golfer) => {
                return (
                  <PairingGolferCard
                    golfer={golfer}
                    groupOptions={draftGroups.map((group) => ({
                      disabled:
                        group.members.length >= 4 &&
                        golfer.draftAssignment?.groupId !== group.id,
                      id: group.id,
                      label: `${group.name} (${group.members.length}/4)`,
                    }))}
                    key={golfer.id}
                  />
                );
              })}
            </FilterableCardGrid>
            <PaginationNav
              label="Unassigned golfers"
              pagination={pagedUnassignedGolfers.pagination}
              searchParams={pairingsSearchParams}
            />
          </>
        )}
      </section>

      <section className={styles.sectionBlock}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionHeading}>
            <h2 className={styles.sectionTitle}>Draft groups</h2>
            <p className={styles.sectionIntro}>
              Generated drafts use neutral group names and start from the same
              fairness rules, including projected group scores that stay as even
              as possible across the board. Adjust tee times, ordering, and
              golfer assignments here before publishing the live board.
            </p>
          </div>
        </div>

        <div className={styles.panel}>
          <h3 className={styles.pairingCreateTitle}>Create new group</h3>
          <form action={createPairingGroup} className={styles.compactForm}>
            <label>
              Name
              <input name="name" required type="text" placeholder="Group 5" />
            </label>
            <label>
              Sort order
              <input
                min="1"
                name="sortOrder"
                required
                type="number"
                defaultValue={nextSortOrder}
              />
            </label>
            <label>
              Tee time (optional)
              <input name="teeTime" type="datetime-local" />
            </label>
            <button className={styles.actionButton} type="submit">
              Create group
            </button>
          </form>
        </div>

        {draftGroups.length === 0 ? (
          <div className={styles.panel}>
            <p className={styles.emptyState}>
              Draft groups will appear here after you generate or create them.
            </p>
          </div>
        ) : (
          <>
            <FilterableCardGrid
              className={styles.compactCardGrid}
              emptyMessage="No draft groups match this search on the current page."
              filterAllLabel="All draft groups"
              filters={groupFilters}
              items={pagedDraftGroups.items}
              pagination={pagedDraftGroups.pagination}
              resultLabel="draft groups"
              searchLabel="Search draft groups"
              searchPlaceholder="Search groups, tee times, golfers"
              urlBackedFilter={{
                value: draftFilter,
                searchParams: pairingsSearchParams,
                filterParamKey: draftFilterParamKey,
                pageParamKey: draftPaginationParams.pageKey,
              }}
            >
              {pagedDraftGroups.records.map((group) => (
                <PairingGroupCard key={group.id} group={group} isDraft={true} />
              ))}
            </FilterableCardGrid>
            <PaginationNav
              label="Draft groups"
              pagination={pagedDraftGroups.pagination}
              searchParams={pairingsSearchParams}
            />
          </>
        )}
      </section>

      {publishedGroups.length > 0 && (
        <section className={styles.sectionBlock}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionHeading}>
              <h2 className={styles.sectionTitle}>Published groups</h2>
              <p className={styles.sectionIntro}>
                {draftGroups.length > 0
                  ? "Currently live on the public site. A separate draft set already exists, so these groups stay read-only until you publish or clear that draft."
                  : "Currently live on the public site. Unpublish to move these groups back to draft so you can edit them again."}
              </p>
            </div>
            <div className={styles.sectionActionStack}>
              <form
                action={submitUnpublishPairings}
                className={styles.actionOnlyForm}
              >
                <button
                  className={styles.secondaryActionButton}
                  disabled={draftGroups.length > 0}
                  type="submit"
                >
                  Unpublish to draft
                </button>
              </form>
              <p className={styles.sectionActionHint}>
                {draftGroups.length > 0
                  ? "Unpublish is locked while another draft set exists, which avoids mixing live and draft groups."
                  : "The public home page only shows published groups, so unpublishing removes this board until you publish again."}
              </p>
            </div>
          </div>
          <FilterableCardGrid
            className={styles.compactCardGrid}
            emptyMessage="No published groups match this search on the current page."
            filterAllLabel="All published groups"
            filters={groupFilters}
            items={pagedPublishedGroups.items}
            pagination={pagedPublishedGroups.pagination}
            resultLabel="published groups"
            searchLabel="Search published groups"
            searchPlaceholder="Search groups, tee times, golfers"
            urlBackedFilter={{
              value: publishedFilter,
              searchParams: pairingsSearchParams,
              filterParamKey: publishedFilterParamKey,
              pageParamKey: publishedPaginationParams.pageKey,
            }}
          >
            {pagedPublishedGroups.records.map((group) => (
              <PairingGroupCard key={group.id} group={group} isDraft={false} />
            ))}
          </FilterableCardGrid>
          <PaginationNav
            label="Published groups"
            pagination={pagedPublishedGroups.pagination}
            searchParams={pairingsSearchParams}
          />
        </section>
      )}
    </>
  );
}
