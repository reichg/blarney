import type { ChairNotice } from "@/app/chair/notices/type";

/** Search param that pairing server actions encode notice codes into. */
export const PAIRINGS_NOTICE_PARAM = "pairings";

/** Outcome codes that chair pairing actions encode into their redirects. */
export type PairingNoticeCode =
  | "generated"
  | "group-created"
  | "group-updated"
  | "group-deleted"
  | "member-assigned"
  | "member-removed"
  | "published"
  | "unpublished"
  | "unpublish-conflict"
  | "unpublish-error"
  | "action-failed";

// Notice copy for chair pairing actions, keyed by the notice code that server
// actions append to their redirect targets. Publish/unpublish are idempotent
// and assignment succeeds even when the golfer was already in the group, so
// the copy avoids claiming specific counts or new state.
export const PAIRING_NOTICES: Record<PairingNoticeCode, ChairNotice> = {
  generated: {
    tone: "success",
    title: "Draft groups generated.",
    body: "A fresh draft set replaced any previous draft groups. Adjust names, tee times, and assignments before publishing.",
  },
  "group-created": {
    tone: "success",
    title: "Draft group created.",
    body: "Assign golfers to the new group from the unassigned list.",
  },
  "group-updated": {
    tone: "success",
    title: "Draft group saved.",
    body: "The group name, sort order, and tee time changes are stored.",
  },
  "group-deleted": {
    tone: "success",
    title: "Draft group deleted.",
    body: "Its golfers are back in the unassigned list.",
  },
  "member-assigned": {
    tone: "success",
    title: "Golfer assignment saved.",
    body: "The golfer is now in the selected draft group.",
  },
  "member-removed": {
    tone: "success",
    title: "Golfer removed from group.",
    body: "The golfer is back in the unassigned list.",
  },
  published: {
    tone: "success",
    title: "Pairings published.",
    body: "Draft groups are now the live board on the public site. If no drafts existed, the live board is unchanged.",
  },
  unpublished: {
    tone: "success",
    title: "Published groups moved back to draft.",
    body: "You can edit group names, tee times, sort order, and golfer assignments again before publishing a new live set.",
  },
  "unpublish-conflict": {
    tone: "error",
    title: "Unpublish blocked while a draft set already exists.",
    body: "Publish or clear the current draft groups before moving the live groups back to draft.",
  },
  "unpublish-error": {
    tone: "error",
    title: "Unpublish did not finish.",
    body: "Reload and try again. If another draft was created in the meantime, clear or publish it first.",
  },
  "action-failed": {
    tone: "error",
    title: "Pairing action did not finish.",
    body: "The change was not saved. Reload and try again.",
  },
};
