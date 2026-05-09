import type { PaginationState, SearchParamsRecord } from "@/lib/type";
import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

export type NavLink = {
  href: string;
  label: string;
  external?: boolean;
};

export type MobileNavigationProps = {
  links: NavLink[];
};

export type PaginationNavProps = {
  pagination: PaginationState;
  searchParams?: SearchParamsRecord;
  label?: string;
};

export type PhotoBrowsePickerProps = {
  description?: string;
  disabled?: boolean;
  emptySelectionLabel?: string;
  helpTextId: string;
  inputName?: string;
  title?: string;
};

export type ModularCardOwnProps<T extends ElementType> = {
  as?: T;
  children: ReactNode;
  className?: string;
};

export type ModularCardProps<T extends ElementType> = ModularCardOwnProps<T> &
  Omit<ComponentPropsWithoutRef<T>, keyof ModularCardOwnProps<T>>;
