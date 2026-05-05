import styles from "@/app/chair/chair.module.css";
import { PaginationNav } from "@/components/PaginationNav";
import { db } from "@/lib/db";
import {
  buildPaginationState,
  parsePaginationParams,
  type PaginationParams,
  type SearchParamsRecord,
} from "@/lib/pagination";

export const dynamic = "force-dynamic";

type ChairFeedbackPageProps = {
  searchParams: Promise<SearchParamsRecord>;
};

async function getFeedback(pagination: PaginationParams) {
  try {
    const [feedback, totalCount] = await Promise.all([
      db.feedback.findMany({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: pagination.skip,
        take: pagination.take,
      }),
      db.feedback.count(),
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

  return (
    <>
      <div className={styles.topline}>
        <div className={styles.pageHeaderCopy}>
          <p className="eyebrow">Private</p>
          <h1>Feedback</h1>
          <p className={styles.pageIntro}>
            Private notes from the public site land here, including general
            event feedback and remembrance messages.
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
              These notes stay private to chair routes and help separate general
              issues from remembrance-related follow-up.
            </p>
          </div>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>From</th>
                <th>Category</th>
                <th>Rating</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {feedback.length === 0 ? (
                <tr>
                  <td colSpan={4} className={styles.muted}>
                    {pagination.isEmpty
                      ? "No feedback yet."
                      : "No feedback on this page."}
                  </td>
                </tr>
              ) : (
                feedback.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {item.name ?? "Anonymous"}
                      <br />
                      {item.email ?? ""}
                    </td>
                    <td>{item.category}</td>
                    <td>{item.rating ?? "-"}</td>
                    <td className={styles.notesCell}>{item.message}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      <PaginationNav
        label="Feedback"
        pagination={pagination}
        searchParams={params}
      />
    </>
  );
}
