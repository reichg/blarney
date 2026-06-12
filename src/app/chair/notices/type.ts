// Chair-named aliases over the shared notice contracts in
// src/components/notices/type so existing chair imports keep working.
export type {
  ActionNotice as ChairNotice,
  ActionNoticeMap as ChairNoticeMap,
  ActionResult as ChairActionResult,
  ActionToastValue as ChairActionToastValue,
  NoticeFormAction as ChairFormAction,
  NoticeFromQueryProps as ChairNoticeFromQueryProps,
  PendingSubmitButtonProps,
  RunActionOptions as RunChairActionOptions,
} from "@/components/notices/type";
