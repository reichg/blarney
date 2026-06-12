"use client";

import { useActionToast } from "@/components/notices/ActionToast";
import type {
  NoticeFromQueryProps,
  UseActionToast,
} from "@/components/notices/type";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

// Builds a notice-from-query component bound to a specific toast hook. Area
// bindings (e.g. chair) inject their own re-exported hook so test doubles of
// that area's toast module keep intercepting toasts.
export function createNoticeFromQuery(useToast: UseActionToast) {
  function NoticeFromQueryReader({ param, notices }: NoticeFromQueryProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { showToast } = useToast();

    useEffect(() => {
      const code = searchParams.get(param);

      if (code === null) {
        return;
      }

      // Own-property check so crafted codes like `__proto__` or `constructor`
      // cannot surface inherited values as a toast.
      if (Object.hasOwn(notices, code)) {
        showToast(notices[code]);
      }

      // Strip only the notice param so refresh/back never replays the toast,
      // while preserving every other param (tab, page, filters) and scroll.
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete(param);
      const query = nextParams.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    }, [notices, param, pathname, router, searchParams, showToast]);

    return null;
  }

  // Surfaces a one-shot toast from a `?<param>=<code>` notice that a server
  // action or redirect left in the URL. Unknown codes are still stripped so
  // stale links cannot pin garbage params. useSearchParams needs a Suspense
  // boundary during prerender; wrapping here keeps consumer pages free of it.
  return function NoticeFromQuery(props: NoticeFromQueryProps) {
    return (
      <Suspense fallback={null}>
        <NoticeFromQueryReader {...props} />
      </Suspense>
    );
  };
}

export const NoticeFromQuery = createNoticeFromQuery(useActionToast);
