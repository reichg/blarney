"use client";

import {
  useMarketplaceActionNavigation,
  type MarketplaceFormAction,
} from "@/app/chair/marketplace/useMarketplaceActionNavigation";
import type { ReactNode } from "react";

type MarketplaceListingActionFormProps = {
  action: MarketplaceFormAction;
  children: ReactNode;
  className?: string;
};

export function MarketplaceListingActionForm({
  action,
  children,
  className,
}: MarketplaceListingActionFormProps) {
  const runMarketplaceAction = useMarketplaceActionNavigation();

  return (
    <form action={runMarketplaceAction(action)} className={className}>
      {children}
    </form>
  );
}
