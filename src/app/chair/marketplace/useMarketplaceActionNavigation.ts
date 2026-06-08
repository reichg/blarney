"use client";

import type { MarketplaceActionResult } from "@/app/actions/marketplace";
import { useRouter } from "next/navigation";

export type MarketplaceFormAction = (
  formData: FormData,
) => Promise<MarketplaceActionResult | void>;

type RunMarketplaceActionOptions = { onResult?: () => void };

// Server actions used to redirect() themselves, which resets scroll to the top.
// They now return the notice URL so the client can navigate without losing scroll.
export function useMarketplaceActionNavigation() {
  const router = useRouter();

  return function runMarketplaceAction(
    action: MarketplaceFormAction,
    options?: RunMarketplaceActionOptions,
  ) {
    return async (formData: FormData) => {
      const result = await action(formData);

      if (result?.redirectTo) {
        options?.onResult?.();
        router.replace(result.redirectTo, { scroll: false });
      }
    };
  };
}
