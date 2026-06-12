"use client";

import {
  MARKETPLACE_NOTICE_PARAM,
  MARKETPLACE_NOTICES,
} from "@/app/chair/marketplace/marketplaceNotices";
import type { ChairFormAction } from "@/app/chair/notices/type";
import { useChairActionNavigation } from "@/app/chair/notices/useChairActionNavigation";

export type MarketplaceFormAction = ChairFormAction;

// Thin marketplace binding over the shared chair action-navigation hook so
// existing marketplace forms keep their import path and semantics.
export function useMarketplaceActionNavigation() {
  return useChairActionNavigation(MARKETPLACE_NOTICE_PARAM, MARKETPLACE_NOTICES);
}
