"use client";

import type { MarketplaceActionResult } from "@/app/actions/marketplace";
import { useMarketplaceToast } from "@/app/chair/marketplace/MarketplaceActionToast";
import { getMarketplaceNoticeContent } from "@/app/chair/marketplace/marketplaceNotices";
import { useRouter } from "next/navigation";

// Pulls the `?marketplace=<code>` notice code out of an action's redirect target
// so the client can decide whether to navigate (success) or surface a toast
// (error) without coupling to the URL shape elsewhere.
function getNoticeCodeFromRedirect(redirectTo: string): string | undefined {
  const query = redirectTo.split("?")[1];

  if (!query) {
    return undefined;
  }

  return new URLSearchParams(query).get("marketplace") ?? undefined;
}

export type MarketplaceFormAction = (
  formData: FormData,
) => Promise<MarketplaceActionResult | void>;

type RunMarketplaceActionOptions = {
  onResult?: () => void;
  // Always runs after the action settles, on both success and validation-error
  // paths, so callers can clear pending UI state regardless of the outcome.
  onSettled?: () => void;
};

// Server actions used to redirect() themselves, which resets scroll to the top.
// They now return the notice URL so the client can navigate without losing scroll.
// Error notices are surfaced as a toast in the viewport instead of navigating, so
// the message stays visible next to the action the chair just took.
export function useMarketplaceActionNavigation() {
  const router = useRouter();
  const showToast = useMarketplaceToast();

  return function runMarketplaceAction(
    action: MarketplaceFormAction,
    options?: RunMarketplaceActionOptions,
  ) {
    return async (formData: FormData) => {
      try {
        const result = await action(formData);

        if (!result?.redirectTo) {
          return;
        }

        const notice = getMarketplaceNoticeContent(
          getNoticeCodeFromRedirect(result.redirectTo),
        );

        if (notice) {
          showToast(notice);
        }

        // Errors stay put so the message sits next to the action; success still
        // navigates to revalidate the catalog, carrying the toast through the
        // scroll-preserving soft navigation.
        if (notice?.tone === "error") {
          return;
        }

        options?.onResult?.();
        router.replace(result.redirectTo, { scroll: false });
      } finally {
        options?.onSettled?.();
      }
    };
  };
}
