import type { PaginationNavProps } from "@/components/type";
import {
  formatPaginationSummary,
  PAGE_SIZE_OPTIONS,
  type SearchParamsRecord,
} from "@/lib/pagination";
import Link from "next/link";
import styles from "./PaginationNav.module.css";

function buildSearchParams(searchParams: SearchParamsRecord | undefined) {
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

  return params;
}

function buildHref(
  searchParams: SearchParamsRecord | undefined,
  pageKey: string,
  page: number,
) {
  const params = buildSearchParams(searchParams);

  params.set(pageKey, `${page}`);

  return `?${params.toString()}`;
}

function buildPageSizeFormEntries(
  searchParams: SearchParamsRecord | undefined,
  pageKey: string,
  pageSizeKey: string,
) {
  const params = buildSearchParams(searchParams);

  params.set(pageKey, "1");
  params.delete(pageSizeKey);

  return Array.from(params.entries());
}

function getSelectedPageSize(pageSize: number) {
  return PAGE_SIZE_OPTIONS.includes(
    pageSize as (typeof PAGE_SIZE_OPTIONS)[number],
  )
    ? pageSize
    : PAGE_SIZE_OPTIONS[0];
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
  const summary = formatPaginationSummary(pagination);
  const pageSizeFormEntries = buildPageSizeFormEntries(
    searchParams,
    pagination.pageKey,
    pagination.pageSizeKey,
  );
  const selectedPageSize = getSelectedPageSize(pagination.pageSize);

  return (
    <div className={styles.pagination}>
      <div className={styles.summary}>
        <div className={styles.summaryCopy}>
          <p>{summary}</p>
          <p className={styles.summaryLine}>{label}</p>
        </div>
        <form className={styles.pageSizeForm} method="get">
          {pageSizeFormEntries.map(([key, value], index) => (
            <input
              key={`${key}-${value}-${index}`}
              name={key}
              type="hidden"
              value={value}
            />
          ))}
          <label className={styles.pageSizeField}>
            <span className={styles.pageSizeLabel}>Per page</span>
            <select
              className={styles.pageSizeSelect}
              defaultValue={`${selectedPageSize}`}
              name={pagination.pageSizeKey}
            >
              {PAGE_SIZE_OPTIONS.map((pageSizeOption) => (
                <option key={pageSizeOption} value={pageSizeOption}>
                  {pageSizeOption}
                </option>
              ))}
            </select>
          </label>
          <button className={styles.linkButton} type="submit">
            Apply
          </button>
        </form>
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
