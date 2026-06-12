"use client";

import type { ChairFormAction, ChairNoticeMap } from "@/app/chair/notices/type";
import { useChairActionNavigation } from "@/app/chair/notices/useChairActionNavigation";
import type { ReactNode } from "react";

type ChairActionFormProps = {
  action: ChairFormAction;
  children: ReactNode;
  className?: string;
  notices: ChairNoticeMap;
  param: string;
};

// Client form boundary for chair server actions: routes submissions through
// the scroll-preserving navigation hook so success notices soft-navigate
// without resetting scroll and error notices surface as toasts without
// navigating at all.
export function ChairActionForm({
  action,
  children,
  className,
  notices,
  param,
}: ChairActionFormProps) {
  const runChairAction = useChairActionNavigation(param, notices);

  return (
    <form action={runChairAction(action)} className={className}>
      {children}
    </form>
  );
}
