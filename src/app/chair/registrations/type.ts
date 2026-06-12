import type { SearchParamsRecord } from "@/lib/pagination";
import type { Prisma } from "@prisma/client";
import type { ReactNode } from "react";

export type ChairRegistrationsPageProps = {
  searchParams: Promise<SearchParamsRecord>;
};

export type ExportCsvButtonProps = {
  href: string;
  fallbackFileName: string;
  className?: string;
  children: ReactNode;
};

export const registrationAttendeeTotalsSelect = {
  adultGuestCount: true,
  childGuestCount: true,
  participant: {
    select: {
      age: true,
      gender: true,
    },
  },
} satisfies Prisma.RegistrationSelect;

export type RegistrationAttendeeTotalsRow = Prisma.RegistrationGetPayload<{
  select: typeof registrationAttendeeTotalsSelect;
}>;

export type RegistrationGolferBreakdown = {
  maleAdultCount: number;
  femaleAdultCount: number;
  otherAdultCount: number;
  maleChildCount: number;
  femaleChildCount: number;
  otherChildCount: number;
};

export type RegistrationGuestBreakdown = {
  totalCount: number;
  adultCount: number;
  childCount: number;
};

export type RegistrationHeaderTotals = {
  totalCount: number;
  golfers: RegistrationGolferBreakdown;
  guests: RegistrationGuestBreakdown;
};

export type RegistrationHeaderSummary = {
  overall: RegistrationHeaderTotals;
  filtered: RegistrationHeaderTotals | null;
};
