"use client";

import styles from "@/app/chair/chair.module.css";
import {
  filterChairListItems,
  type ChairListItemFilter,
  type ChairListSearchItem,
} from "@/app/chair/listFiltering";
import { Children, useMemo, useState, type ReactNode } from "react";

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
};

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
}: FilterableCardGridProps) {
  const [query, setQuery] = useState("");
  const [filterValue, setFilterValue] = useState("");
  const childItems = Children.toArray(children);
  const filteredItems = useMemo(
    () => filterChairListItems(items, query, filterValue),
    [filterValue, items, query],
  );
  const visibleIds = new Set(filteredItems.map((item) => item.id));
  const visibleChildren = childItems.filter((_, index) =>
    visibleIds.has(items[index]?.id ?? ""),
  );

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
              onChange={(event) => setFilterValue(event.target.value)}
              value={filterValue}
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
          Showing {visibleChildren.length} of {items.length} {resultLabel} on
          this page
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
