import type { ActionNotice } from "@/components/notices/type";

/** Search param that the feedback server action encodes notice codes into. */
export const FEEDBACK_NOTICE_PARAM = "feedback";

/** Outcome codes that the feedback action encodes into its redirects. */
export type FeedbackNoticeCode = "submit-failed";

// Notice copy for the public feedback form, keyed by the notice code the
// server action appends to its redirect target. Copy is static so no server
// error detail ever reaches the visitor.
export const FEEDBACK_NOTICES: Record<FeedbackNoticeCode, ActionNotice> = {
  "submit-failed": {
    tone: "error",
    title: "Your feedback was not sent.",
    body: "Something went wrong while saving it. Your entries are still in the form, so please try sending it again.",
  },
};
