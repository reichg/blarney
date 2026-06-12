import type { ReactNode } from "react";

// Shared action notice contracts, consumed by the toast provider, the
// query-param notice reader, and the action-navigation hook on any page
// (chair or public). Notice copy is always static, developer-authored text.

export type ActionNotice = {
  tone: "success" | "error";
  title: string;
  body?: string;
};

/** Notice code (as encoded in a URL search param) to notice copy. */
export type ActionNoticeMap = Record<string, ActionNotice>;

export type ActionToastValue = {
  showToast: (notice: ActionNotice) => void;
};

/**
 * Toast-context hook signature. Area bindings (e.g. chair) inject their own
 * re-exported hook so test doubles of that area's toast module keep
 * intercepting toasts.
 */
export type UseActionToast = () => ActionToastValue;

export type ActionResult = { redirectTo: string };

export type NoticeFormAction = (
  formData: FormData,
) => Promise<ActionResult | void>;

export type RunActionOptions = {
  // Runs only on success, before navigation.
  onResult?: () => void;
  // Always runs after the action settles, on both success and validation-error
  // paths, so callers can clear pending UI state regardless of the outcome.
  onSettled?: () => void;
};

export type NoticeFromQueryProps = {
  param: string;
  notices: ActionNoticeMap;
};

export type PendingSubmitButtonProps = {
  children: ReactNode;
  className?: string;
  pendingLabel?: string;
};
