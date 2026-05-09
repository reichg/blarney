import type { SearchParamsRecord } from "@/lib/pagination";

export type HomePageProps = {
  searchParams: Promise<SearchParamsRecord>;
};
