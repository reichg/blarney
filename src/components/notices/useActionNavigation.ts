"use client";

import { useActionToast } from "@/components/notices/ActionToast";
import type {
  ActionNoticeMap,
  NoticeFormAction,
  RunActionOptions,
  UseActionToast,
} from "@/components/notices/type";
import { useRouter } from "next/navigation";

// Pulls the `?<param>=<code>` notice code out of an action's redirect target
// so the client can decide whether to navigate (success) or surface a toast
// (error) without coupling to the URL shape elsewhere.
function getNoticeCodeFromRedirect(
  redirectTo: string,
  param: string,
): string | undefined {
  const query = redirectTo.split("?")[1];

  if (!query) {
    return undefined;
  }

  return new URLSearchParams(query).get(param) ?? undefined;
}

// Builds an action-navigation hook bound to a specific toast hook. Area
// bindings (e.g. chair) inject their own re-exported hook so test doubles of
// that area's toast module keep intercepting toasts.
//
// Server actions return their notice URL instead of redirect()ing themselves,
// which would reset scroll to the top. Error notices are surfaced as a toast
// in the viewport without navigating, so the message stays visible next to the
// action the user just took; success still navigates to revalidate data,
// carrying the toast through the scroll-preserving soft navigation.
export function createUseActionNavigation(useToast: UseActionToast) {
  return function useActionNavigation(param: string, notices: ActionNoticeMap) {
    const router = useRouter();
    const { showToast } = useToast();

    return function runAction(
      action: NoticeFormAction,
      options?: RunActionOptions,
    ) {
      return async (formData: FormData) => {
        try {
          const result = await action(formData);

          if (!result?.redirectTo) {
            return;
          }

          const code = getNoticeCodeFromRedirect(result.redirectTo, param);
          // Own-property check so codes like `__proto__` cannot resolve to
          // inherited values and surface as a malformed toast.
          const notice =
            code !== undefined && Object.hasOwn(notices, code)
              ? notices[code]
              : null;

          if (notice) {
            showToast(notice);
          }

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
  };
}

export const useActionNavigation = createUseActionNavigation(useActionToast);
