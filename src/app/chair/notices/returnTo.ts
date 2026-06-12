import type { SearchParamsRecord } from "@/lib/pagination";

// Serializes the page's own sanitized search params into a same-page relative
// URL so action redirects can land back on the chair's current page/filters.
export function buildReturnTo(
  basePath: string,
  searchParams: SearchParamsRecord,
) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        params.append(key, entry);
      }
    } else if (typeof value === "string") {
      params.set(key, value);
    }
  }

  const query = params.toString();

  return query ? `${basePath}?${query}` : basePath;
}
