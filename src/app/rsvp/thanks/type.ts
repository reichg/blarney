import type { SearchParamsRecord } from "@/lib/type";

export type RsvpThanksPageProps = {
  searchParams: Promise<SearchParamsRecord>;
};

export type RsvpStatusCard = {
  eyebrow: string;
  title: string;
  body: string;
  nextSteps: string[];
  note?: string;
  actionLabel?: string;
};
