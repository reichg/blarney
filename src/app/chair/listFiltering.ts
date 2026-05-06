export type ChairListItemFilter = {
  value: string;
  label: string;
};

export type ChairListSearchItem = {
  id: string;
  searchText: string;
  filters?: string[];
};

function normalize(value: string) {
  return value.trim().toLocaleLowerCase();
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
