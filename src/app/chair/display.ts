import type { ChairListItemFilter } from "@/app/chair/listFiltering";

export function displayValue(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return `${value}`;
  }

  const trimmed = value?.trim();

  return trimmed ? trimmed : "N/A";
}

export function joinSearchText(
  parts: Array<string | number | null | undefined>,
) {
  return parts.map(displayValue).join(" ");
}

export function uniqueFilterOptions(filters: ChairListItemFilter[]) {
  const seen = new Set<string>();

  return filters.filter((filter) => {
    if (seen.has(filter.value)) {
      return false;
    }

    seen.add(filter.value);

    return true;
  });
}
