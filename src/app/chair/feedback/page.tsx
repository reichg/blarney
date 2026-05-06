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
import { REMEMBRANCE_FEEDBACK_CATEGORY } from "@/lib/remembrance";

export const dynamic = "force-dynamic";

type ChairFeedbackPageProps = {
  searchParams: Promise<SearchParamsRecord>;
};

const chairFeedbackWhere = {
  category: {
    not: REMEMBRANCE_FEEDBACK_CATEGORY,
  },
};

async function getFeedback(pagination: PaginationParams) {
  try {
    const [feedback, totalCount] = await Promise.all([
      db.feedback.findMany({
        where: chairFeedbackWhere,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: pagination.skip,
        take: pagination.take,
      }),
      db.feedback.count({ where: chairFeedbackWhere }),
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
  const params = await searchParams;
  const paginationParams = parsePaginationParams(params);
  const { feedback, pagination } = await getFeedback(paginationParams);
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
    { value: "rating:none", label: "No rating" },
    ...feedback.map((item) => ({
      value: `category:${item.category}`,
      label: item.category,
    })),
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
            resultLabel="messages"
            searchLabel="Search feedback"
            searchPlaceholder="Search names, emails, categories, messages"
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
        searchParams={params}
      />
    </>
  );
}
