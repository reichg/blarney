import type { PaginationState, SearchParamsRecord } from "@/lib/type";
import type { ReactNode } from "react";

export type ChairLink = {
  href: string;
  label: string;
};

export type ChairListItemFilter = {
  value: string;
  label: string;
};

export type ChairListSearchItem = {
  id: string;
  searchText: string;
  filters?: string[];
};

export type PreviewDetailCardProps = {
  title: string;
  openLabel: string;
  eyebrow?: string;
  header?: ReactNode;
  preview: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

export type ChairShellProps = {
  children: ReactNode;
  logout: ReactNode;
};

export type UrlBackedFilter = {
  value: string;
  searchParams: SearchParamsRecord;
  filterParamKey?: string;
  pageParamKey?: string;
};

export type FilterableCardGridProps = {
  items: ChairListSearchItem[];
  filters?: readonly ChairListItemFilter[];
  searchLabel: string;
  searchPlaceholder: string;
  filterLabel?: string;
  filterAllLabel?: string;
  emptyMessage: string;
  resultLabel: string;
  className?: string;
  children?: ReactNode;
  urlBackedFilter?: UrlBackedFilter;
  pagination?: PaginationState;
};
