"use client";

import styles from "@/app/chair/chair.module.css";
import {
  filterChairListItems,
  type ChairListItemFilter,
  type ChairListSearchItem,
} from "@/app/chair/listFiltering";
import {
  formatPaginationSummary,
  type PaginationState,
  type SearchParamsRecord,
} from "@/lib/pagination";
import { usePathname, useRouter } from "next/navigation";
import {
  Children,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";

type UrlBackedFilter = {
  value: string;
  searchParams: SearchParamsRecord;
  filterParamKey?: string;
  pageParamKey?: string;
};

type FilterableCardGridProps = {
  items: ChairListSearchItem[];
  filters?: ChairListItemFilter[];
  searchLabel: string;
  searchPlaceholder: string;
  filterLabel?: string;
  filterAllLabel?: string;
  emptyMessage: string;
  resultLabel: string;
  className?: string;
  children: ReactNode;
  urlBackedFilter?: UrlBackedFilter;
  pagination?: PaginationState;
};

function buildSearchParams(searchParams: SearchParamsRecord) {
  const params = new URLSearchParams();

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

  return params;
}

export function FilterableCardGrid({
  items,
  filters = [],
  searchLabel,
  searchPlaceholder,
  filterLabel = "Filter",
  filterAllLabel = "All",
  emptyMessage,
  resultLabel,
  className,
  children,
  urlBackedFilter,
  pagination,
}: FilterableCardGridProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [filterValue, setFilterValue] = useState("");
  const activeFilterValue = urlBackedFilter?.value ?? filterValue;
  const childItems = Children.toArray(children);
  const filteredItems = useMemo(
    () =>
      filterChairListItems(items, query, urlBackedFilter ? "" : filterValue),
    [filterValue, items, query, urlBackedFilter],
  );
  const visibleIds = new Set(filteredItems.map((item) => item.id));
  const visibleChildren = childItems.filter((_, index) =>
    visibleIds.has(items[index]?.id ?? ""),
  );
  const summary = pagination
    ? formatPaginationSummary(pagination)
    : `Showing ${visibleChildren.length} of ${items.length} ${resultLabel}`;

  function handleFilterChange(nextFilterValue: string) {
    if (!urlBackedFilter) {
      setFilterValue(nextFilterValue);
      return;
    }

    const params = buildSearchParams(urlBackedFilter.searchParams);
    const filterParamKey = urlBackedFilter.filterParamKey ?? "filter";
    const pageParamKey = urlBackedFilter.pageParamKey ?? "page";

    if (nextFilterValue) {
      params.set(filterParamKey, nextFilterValue);
    } else {
      params.delete(filterParamKey);
    }

    params.set(pageParamKey, "1");

    const href = params.size ? `${pathname}?${params.toString()}` : pathname;

    startTransition(() => {
      router.replace(href, { scroll: false });
    });
  }

  return (
    <div className={styles.listSurface}>
      <div className={styles.listControls}>
        <label className={styles.listControlField}>
          <span>{searchLabel}</span>
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            type="search"
            value={query}
          />
        </label>
        {filters.length ? (
          <label className={styles.listControlField}>
            <span>{filterLabel}</span>
            <select
              disabled={isPending}
              onChange={(event) => handleFilterChange(event.target.value)}
              value={activeFilterValue}
            >
              <option value="">{filterAllLabel}</option>
              {filters.map((filter) => (
                <option key={filter.value} value={filter.value}>
                  {filter.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <p aria-live="polite" className={styles.listResultCount}>
          {summary}
        </p>
      </div>
      {visibleChildren.length ? (
        <div className={`${styles.cardGrid} ${className ?? ""}`}>
          {visibleChildren}
        </div>
      ) : (
        <section className={styles.panel}>
          <p className={styles.emptyState}>{emptyMessage}</p>
        </section>
      )}
    </div>
  );
}
