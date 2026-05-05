import {
  type PaginationState,
  type SearchParamsRecord,
} from "@/lib/pagination";
import Link from "next/link";
import styles from "./PaginationNav.module.css";

type PaginationNavProps = {
  pagination: PaginationState;
  searchParams?: SearchParamsRecord;
  label?: string;
};

function buildHref(
  searchParams: SearchParamsRecord | undefined,
  pageKey: string,
  page: number,
) {
  const params = new URLSearchParams();

  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (Array.isArray(value)) {
        for (const entry of value) {
          params.append(key, entry);
        }

        continue;
      }

      if (typeof value === "string") {
        params.set(key, value);
      }
    }
  }

  params.set(pageKey, `${page}`);

  return `?${params.toString()}`;
}

export function PaginationNav({
  pagination,
  searchParams,
  label = "Results",
}: PaginationNavProps) {
  if (pagination.isEmpty) {
    return null;
  }

  const isPastLastPage = pagination.page > pagination.totalPages;
  const currentPage = Math.min(pagination.page, pagination.totalPages);
  const previousPage = isPastLastPage ? pagination.totalPages : currentPage - 1;
  const hasPreviousPage = currentPage > 1 || isPastLastPage;
  const hasNextPage = currentPage < pagination.totalPages;
  const summary = pagination.currentCount
    ? `Showing ${pagination.startIndex}-${pagination.endIndex} of ${pagination.totalCount}`
    : `Showing 0 of ${pagination.totalCount}`;

  return (
    <div className={styles.pagination}>
      <div className={styles.summary}>
        <p>{summary}</p>
        <p className={styles.summaryLine}>{label}</p>
      </div>
      <nav aria-label={`${label} pages`} className={styles.controls}>
        {hasPreviousPage ? (
          <Link
            className={styles.link}
            href={buildHref(searchParams, pagination.pageKey, previousPage)}
            rel="prev"
          >
            Previous
          </Link>
        ) : (
          <span aria-disabled="true" className={styles.disabledLink}>
            Previous
          </span>
        )}
        <p className={styles.context}>
          Page {currentPage} of {pagination.totalPages}
        </p>
        {hasNextPage ? (
          <Link
            className={styles.link}
            href={buildHref(searchParams, pagination.pageKey, currentPage + 1)}
            rel="next"
          >
            Next
          </Link>
        ) : (
          <span aria-disabled="true" className={styles.disabledLink}>
            Next
          </span>
        )}
      </nav>
    </div>
  );
}
