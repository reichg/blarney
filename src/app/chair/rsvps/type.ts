import type { ChairRsvpPartyCounts } from "@/lib/chairRsvps";
import type { SearchParamsRecord } from "@/lib/pagination";

export type ChairRsvpsPageProps = {
  searchParams: Promise<SearchParamsRecord>;
};

export type ChairRsvpHeaderTotals = {
  overall: ChairRsvpPartyCounts;
  filtered: ChairRsvpPartyCounts | null;
};
