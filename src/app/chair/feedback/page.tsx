import styles from "@/app/chair/chair.module.css";
import {
  displayValue,
  joinSearchText,
  uniqueFilterOptions,
} from "@/app/chair/display";
import { FilterableCardGrid } from "@/app/chair/FilterableCardGrid";
import {
  parseChairListFilterParam,
  pickSearchParams,
} from "@/app/chair/listFiltering";
import { PreviewDetailCard } from "@/app/chair/PreviewDetailCard";
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
import { REMEMBRANCE_FEEDBACK_CATEGORY } from "@/lib/remembrance";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

type ChairFeedbackPageProps = {
  searchParams: Promise<SearchParamsRecord>;
};

const feedbackFilterParamKey = "filter";

const chairFeedbackWhere = {
  category: {
    not: REMEMBRANCE_FEEDBACK_CATEGORY,
  },
} satisfies Prisma.FeedbackWhereInput;

function parseFeedbackFilter(searchParams: SearchParamsRecord | undefined) {
  const filterValue = parseChairListFilterParam(
    searchParams,
    feedbackFilterParamKey,
  );

  if (filterValue === "rating:provided" || filterValue === "rating:none") {
    return filterValue;
  }

  if (filterValue.startsWith("category:")) {
    const category = filterValue.slice("category:".length).trim();

    return category ? `category:${category}` : "";
  }

  return "";
}

function buildFeedbackWhere(filterValue: string): Prisma.FeedbackWhereInput {
  if (!filterValue) {
    return chairFeedbackWhere;
  }

  if (filterValue === "rating:provided") {
    return {
      ...chairFeedbackWhere,
      rating: {
        not: null,
      },
    };
  }

  if (filterValue === "rating:none") {
    return {
      ...chairFeedbackWhere,
      rating: null,
    };
  }

  return {
    ...chairFeedbackWhere,
    category: {
      equals: filterValue.slice("category:".length),
      mode: "insensitive",
    },
  };
}

async function getFeedback(pagination: PaginationParams, filterValue: string) {
  const feedbackWhere = buildFeedbackWhere(filterValue);

  try {
    const [feedback, totalCount] = await Promise.all([
      db.feedback.findMany({
        where: feedbackWhere,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: pagination.skip,
        take: pagination.take,
      }),
      db.feedback.count({ where: feedbackWhere }),
    ]);

    return {
      feedback,
      pagination: buildPaginationState(pagination, totalCount),
    };
  } catch {
    return {
      feedback: [],
      pagination: buildPaginationState(pagination, 0),
    };
  }
}

export default async function ChairFeedbackPage({
  searchParams,
}: ChairFeedbackPageProps) {
  await requireChairPageAuth("/chair/feedback");

  const params = await searchParams;
  const paginationParams = parsePaginationParams(params);
  const feedbackFilter = parseFeedbackFilter(params);
  const paginationSearchParams = pickSearchParams(params, [
    paginationParams.pageKey,
    paginationParams.pageSizeKey,
  ]);

  if (feedbackFilter) {
    paginationSearchParams[feedbackFilterParamKey] = feedbackFilter;
  }

  const { feedback, pagination } = await getFeedback(
    paginationParams,
    feedbackFilter,
  );
  const feedbackSearchItems = feedback.map((item) => ({
    id: item.id,
    searchText: joinSearchText([
      item.name,
      item.email,
      item.category,
      item.rating,
      item.message,
    ]),
    filters: [
      `category:${item.category}`,
      item.rating === null ? "rating:none" : "rating:provided",
    ],
  }));
  const feedbackFilters = uniqueFilterOptions([
    { value: "rating:provided", label: "Has rating" },
    { value: "category:Logistics", label: "Logistics" },
    { value: "category:Photos", label: "Photos" },
    { value: "category:Pairings", label: "Pairings" },
    { value: "category:Other", label: "Other" },
  ]);

  return (
    <>
      <div className={styles.topline}>
        <div className={styles.pageHeaderCopy}>
          <p className="eyebrow">Private</p>
          <h1>Feedback</h1>
          <p className={styles.pageIntro}>
            Private notes from the public feedback form land here for chair
            review.
          </p>
          <div className={styles.pageMetaBar}>
            <span className={styles.pageMeta}>
              {pagination.totalCount} total message
              {pagination.totalCount === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      </div>
      <section className={styles.sectionBlock}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionHeading}>
            <h2 className={styles.sectionTitle}>Recent messages</h2>
            <p className={styles.sectionIntro}>
              These notes stay private to chair routes. Remembrance entries are
              reviewed separately on the remembrance screen.
            </p>
          </div>
        </div>
        {feedback.length === 0 ? (
          <section className={styles.panel}>
            <p className={styles.emptyState}>
              {pagination.isEmpty
                ? "No feedback yet."
                : "No feedback on this page."}
            </p>
          </section>
        ) : (
          <FilterableCardGrid
            emptyMessage="No feedback messages match this search on the current page."
            filterAllLabel="All feedback"
            filters={feedbackFilters}
            items={feedbackSearchItems}
            pagination={pagination}
            resultLabel="messages"
            searchLabel="Search feedback"
            searchPlaceholder="Search names, emails, categories, messages"
            urlBackedFilter={{
              value: feedbackFilter,
              searchParams: paginationSearchParams,
              filterParamKey: feedbackFilterParamKey,
              pageParamKey: paginationParams.pageKey,
            }}
          >
            {feedback.map((item) => {
              const sender = item.name ?? "Anonymous";
              const ratingLabel =
                item.rating === null ? "N/A" : `${item.rating}`;

              return (
                <PreviewDetailCard
                  eyebrow="Feedback"
                  key={item.id}
                  openLabel={`Open feedback details from ${sender}`}
                  preview={
                    <>
                      <p className={styles.cardKicker}>{item.category}</p>
                      <h3 className={styles.cardTitle}>{sender}</h3>
                      <p className={styles.cardMeta}>
                        {displayValue(item.email)}
                      </p>
                      <div className={styles.cardMetaGrid}>
                        <span className={styles.metric}>
                          <span>Rating</span>
                          <strong>{ratingLabel}</strong>
                        </span>
                        <span className={styles.metric}>
                          <span>Received</span>
                          <strong>{formatDateTime(item.createdAt)}</strong>
                        </span>
                      </div>
                      <p className={styles.cardText}>{item.message}</p>
                    </>
                  }
                  title={sender}
                >
                  <div className={styles.detailStack}>
                    <div className={styles.detailGrid}>
                      <div className={styles.detailItem}>
                        <span>Name</span>
                        <p>{sender}</p>
                      </div>
                      <div className={styles.detailItem}>
                        <span>Email</span>
                        <p>{displayValue(item.email)}</p>
                      </div>
                      <div className={styles.detailItem}>
                        <span>Category</span>
                        <p>{item.category}</p>
                      </div>
                      <div className={styles.detailItem}>
                        <span>Rating</span>
                        <p>{ratingLabel}</p>
                      </div>
                      <div className={styles.detailItem}>
                        <span>Received</span>
                        <p>{formatDateTime(item.createdAt)}</p>
                      </div>
                    </div>
                    <div className={styles.detailItem}>
                      <span>Message</span>
                      <p>{item.message}</p>
                    </div>
                  </div>
                </PreviewDetailCard>
              );
            })}
          </FilterableCardGrid>
        )}
      </section>
      <PaginationNav
        label="Feedback"
        pagination={pagination}
        searchParams={paginationSearchParams}
      />
    </>
  );
}
