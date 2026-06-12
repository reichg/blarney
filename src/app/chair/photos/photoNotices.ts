import type { ChairNotice } from "@/app/chair/notices/type";

/** Search param that chair photo server actions encode notice codes into. */
export const PHOTOS_NOTICE_PARAM = "photos";

/** Outcome codes that chair photo actions encode into their redirects. */
export type PhotoNoticeCode =
  | "approved"
  | "rejected"
  | "returned"
  | "deleted"
  | "action-failed";

// Notice copy for chair photo moderation actions, keyed by the notice code
// that server actions append to their redirect targets.
export const PHOTO_NOTICES: Record<PhotoNoticeCode, ChairNotice> = {
  approved: {
    tone: "success",
    title: "Photo approved.",
    body: "The photo moved to the public gallery and out of the pending queue.",
  },
  rejected: {
    tone: "success",
    title: "Photo rejected and deleted.",
    body: "The upload was removed permanently and will never appear in the gallery.",
  },
  returned: {
    tone: "success",
    title: "Photo returned to pending.",
    body: "The photo left the public gallery and is back in the review queue.",
  },
  deleted: {
    tone: "success",
    title: "Pending photo deleted.",
    body: "The upload was removed permanently.",
  },
  "action-failed": {
    tone: "error",
    title: "Photo action did not finish.",
    body: "The photo was not changed. Reload and try again.",
  },
};
