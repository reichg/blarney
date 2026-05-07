import type { SearchParamsRecord } from "@/lib/pagination";
import { z } from "zod";

export type ChairListItemFilter = {
  value: string;
  label: string;
};

export type ChairListSearchItem = {
  id: string;
  searchText: string;
  filters?: string[];
};

const chairListFilterParamSchema = z.string().trim().max(80);

function resolveSearchParamValue(value: string | string[] | undefined) {
  const resolvedValue = Array.isArray(value) ? value[0] : value;

  if (typeof resolvedValue !== "string") {
    return "";
  }

  return resolvedValue.trim();
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase();
}

export function parseChairListFilterParam(
  searchParams: SearchParamsRecord | undefined,
  filterKey = "filter",
) {
  const rawValue = resolveSearchParamValue(searchParams?.[filterKey]);

  if (!rawValue) {
    return "";
  }

  const result = chairListFilterParamSchema.safeParse(rawValue);

  return result.success ? result.data : "";
}

export function pickSearchParams(
  searchParams: SearchParamsRecord | undefined,
  allowedKeys: readonly string[],
): SearchParamsRecord {
  const params = searchParams ?? {};
  const selectedParams: SearchParamsRecord = {};

  for (const key of allowedKeys) {
    const value = params[key];

    if (value !== undefined) {
      selectedParams[key] = value;
    }
  }

  return selectedParams;
}

export function filterChairListItems(
  items: ChairListSearchItem[],
  query: string,
  filterValue: string,
) {
  const normalizedQuery = normalize(query);
  const normalizedFilter = normalize(filterValue);

  return items.filter((item) => {
    const matchesSearch = normalizedQuery
      ? normalize(item.searchText).includes(normalizedQuery)
      : true;
    const matchesFilter = normalizedFilter
      ? (item.filters ?? []).some(
          (filter) => normalize(filter) === normalizedFilter,
        )
      : true;

    return matchesSearch && matchesFilter;
  });
}
