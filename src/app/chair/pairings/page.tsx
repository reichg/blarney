import {
  assignPairingMember,
  createPairingGroup,
  deletePairingGroup,
  generatePairings,
  publishPairings,
  removePairingMember,
  unpublishPairings,
  updatePairingGroup,
} from "@/app/actions/pairings";
import styles from "@/app/chair/chair.module.css";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { type SearchParamsRecord } from "@/lib/pagination";
import { completeRegistrationPaymentStatuses } from "@/lib/payment";
import type { Gender, PairingStatus, Participant } from "@prisma/client";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type PairingGroupWithMembers = {
  id: string;
  name: string;
  teeTime: Date | null;
  sortOrder: number;
  status: PairingStatus;
  members: Array<{
    id: string;
    slot: number;
    snapshotScore: number;
    snapshotAge: number;
    snapshotGender: Gender;
    participant: Participant;
  }>;
};

type GolferAssignment = {
  groupId: string;
  groupName: string;
} | null;

type ChairPairingsPageProps = {
  searchParams?: Promise<SearchParamsRecord>;
};

type PairingNotice = {
  tone: "success" | "error";
  title: string;
  body: string;
};

const chairPairingsPath = "/chair/pairings";

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getPairingNotice(
  value: string | string[] | undefined,
): PairingNotice | null {
  switch (getParam(value)) {
    case "unpublished":
      return {
        tone: "success",
        title: "Published groups moved back to draft.",
        body: "You can edit group names, tee times, sort order, and golfer assignments again before publishing a new live set.",
      };
    case "unpublish-conflict":
      return {
        tone: "error",
        title: "Unpublish blocked while a draft set already exists.",
        body: "Publish or clear the current draft groups before moving the live groups back to draft.",
      };
    case "unpublish-error":
      return {
        tone: "error",
        title: "Unpublish did not finish.",
        body: "Reload and try again. If another draft was created in the meantime, clear or publish it first.",
      };
    default:
      return null;
  }
}

async function submitUnpublishPairings() {
  "use server";

  try {
    await unpublishPairings();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const notice = message.includes("draft pairings already exist")
      ? "unpublish-conflict"
      : "unpublish-error";

    redirect(`${chairPairingsPath}?pairings=${notice}`);
  }

  redirect(`${chairPairingsPath}?pairings=unpublished`);
}

function datetimeLocalValue(value: Date | null) {
  if (!value) {
    return "";
  }

  const offsetMs = value.getTimezoneOffset() * 60 * 1000;
  return new Date(value.getTime() - offsetMs).toISOString().slice(0, 16);
}

async function getPairingData() {
  try {
    const [draftGroups, publishedGroups, paidGolfers] = await Promise.all([
      db.pairingGroup.findMany({
        where: { status: "DRAFT" },
        include: {
          members: {
            include: { participant: true },
            orderBy: { slot: "asc" },
          },
        },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      }),
      db.pairingGroup.findMany({
        where: { status: "PUBLISHED" },
        include: {
          members: {
            include: { participant: true },
            orderBy: { slot: "asc" },
          },
        },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      }),
      db.participant.findMany({
        where: {
          registrations: {
            some: {
              paymentStatus: {
                in: [...completeRegistrationPaymentStatuses],
              },
            },
          },
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
    ]);

    const assignmentByParticipantId = new Map<string, GolferAssignment>();

    for (const group of draftGroups) {
      for (const member of group.members) {
        assignmentByParticipantId.set(member.participantId, {
          groupId: group.id,
          groupName: group.name,
        });
      }
    }

    const golfers = paidGolfers.map((participant) => ({
      ...participant,
      draftAssignment: assignmentByParticipantId.get(participant.id) ?? null,
    }));

    const unassignedGolferCount = golfers.filter(
      (participant) => !participant.draftAssignment,
    ).length;

    const nextSortOrder =
      draftGroups.length > 0
        ? Math.max(...draftGroups.map((g) => g.sortOrder)) + 1
        : publishedGroups.length > 0
          ? Math.max(...publishedGroups.map((g) => g.sortOrder)) + 1
          : 1;

    return {
      draftGroups,
      publishedGroups,
      golfers,
      paidGolferCount: paidGolfers.length,
      nextSortOrder,
      unassignedGolferCount,
    };
  } catch {
    return {
      draftGroups: [],
      publishedGroups: [],
      golfers: [],
      paidGolferCount: 0,
      nextSortOrder: 1,
      unassignedGolferCount: 0,
    };
  }
}

export default async function ChairPairingsPage({
  searchParams,
}: ChairPairingsPageProps) {
  const params = (await searchParams) ?? {};
  const pairingNotice = getPairingNotice(params.pairings);
  const {
    draftGroups,
    publishedGroups,
    golfers,
    paidGolferCount,
    nextSortOrder,
    unassignedGolferCount,
  } = await getPairingData();

  return (
    <>
      <div className={styles.topline}>
        <div className={styles.pageHeaderCopy}>
          <p className="eyebrow">Private</p>
          <h1>Pairings</h1>
          <p className={styles.pageIntro}>
            Generate neutral draft groups that aim for at least one female when
            possible, one older-player anchor per group, a balanced mix of
            lower- and higher-scoring golfers, and group scores that stay as
            even as possible across the board. Publish when tee times and
            ordering are ready.
          </p>
          <div className={styles.pageMetaBar}>
            <span className={styles.pageMeta}>
              {paidGolferCount} paid golfer{paidGolferCount === 1 ? "" : "s"}
            </span>
            <span className={styles.pageMeta}>
              {unassignedGolferCount} unassigned
            </span>
            <span className={styles.pageMeta}>
              {draftGroups.length} draft group
              {draftGroups.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        <div className={styles.actions}>
          <form action={generatePairings}>
            <button className={styles.actionButton} type="submit">
              Generate draft groups
            </button>
          </form>
          <form action={publishPairings}>
            <button
              className={styles.actionButton}
              disabled={draftGroups.length === 0}
              type="submit"
            >
              Publish draft
            </button>
          </form>
        </div>
      </div>

      {pairingNotice ? (
        <section
          aria-live="polite"
          className={`${styles.panel} ${styles.pairingNotice} ${
            pairingNotice.tone === "error"
              ? styles.pairingNoticeError
              : styles.pairingNoticeSuccess
          }`}
          role={pairingNotice.tone === "error" ? "alert" : "status"}
        >
          <p className={styles.pairingNoticeTitle}>{pairingNotice.title}</p>
          <p className={styles.pairingNoticeBody}>{pairingNotice.body}</p>
        </section>
      ) : null}

      <section className={styles.sectionBlock}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionHeading}>
            <h2 className={styles.sectionTitle}>Golfers</h2>
            <p className={styles.sectionIntro}>
              Paid golfers and their current draft group assignment.
            </p>
          </div>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Age</th>
                <th>Gender</th>
                <th>Score</th>
                <th>Draft group</th>
                <th>Assign or move</th>
              </tr>
            </thead>
            <tbody>
              {golfers.length === 0 ? (
                <tr>
                  <td colSpan={6}>No paid golfers are ready for pairings.</td>
                </tr>
              ) : (
                golfers.map((golfer) => (
                  <tr key={golfer.id}>
                    <td>
                      {golfer.firstName} {golfer.lastName}
                    </td>
                    <td>{golfer.age}</td>
                    <td>{golfer.gender}</td>
                    <td>{golfer.averageScore}</td>
                    <td>
                      {golfer.draftAssignment ? (
                        <span className={styles.statusPill}>
                          {golfer.draftAssignment.groupName}
                        </span>
                      ) : (
                        <span className={styles.muted}>Unassigned</span>
                      )}
                    </td>
                    <td>
                      {draftGroups.length > 0 ? (
                        <form
                          action={assignPairingMember}
                          className={styles.tableActionForm}
                        >
                          <input
                            name="participantId"
                            type="hidden"
                            value={golfer.id}
                          />
                          <select
                            name="groupId"
                            required
                            defaultValue={golfer.draftAssignment?.groupId ?? ""}
                          >
                            <option value="">Select group</option>
                            {draftGroups.map((group) => {
                              const isCurrentGroup =
                                golfer.draftAssignment?.groupId === group.id;

                              return (
                                <option
                                  key={group.id}
                                  value={group.id}
                                  disabled={
                                    group.members.length >= 4 && !isCurrentGroup
                                  }
                                >
                                  {group.name} ({group.members.length}/4)
                                </option>
                              );
                            })}
                          </select>
                          <button className={styles.actionButton} type="submit">
                            {golfer.draftAssignment ? "Move" : "Assign"}
                          </button>
                        </form>
                      ) : (
                        <span className={styles.muted}>No draft groups</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.sectionBlock}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionHeading}>
            <h2 className={styles.sectionTitle}>Draft groups</h2>
            <p className={styles.sectionIntro}>
              Generated drafts use neutral group names and start from the same
              fairness rules, including projected group scores that stay as even
              as possible across the board. Adjust tee times, ordering, and
              golfer assignments here before publishing the live board.
            </p>
          </div>
        </div>

        <div className={styles.panel}>
          <h3 className={styles.pairingCreateTitle}>Create new group</h3>
          <form action={createPairingGroup} className={styles.compactForm}>
            <label>
              Name
              <input name="name" required type="text" placeholder="Group 5" />
            </label>
            <label>
              Sort order
              <input
                min="1"
                name="sortOrder"
                required
                type="number"
                defaultValue={nextSortOrder}
              />
            </label>
            <label>
              Tee time (optional)
              <input name="teeTime" type="datetime-local" />
            </label>
            <button className={styles.actionButton} type="submit">
              Create group
            </button>
          </form>
        </div>

        <section className={styles.pairingGrid}>
          {draftGroups.length === 0 ? (
            <div className={styles.panel}>
              <p className={styles.emptyState}>
                Draft groups will appear here after you generate or create them.
              </p>
            </div>
          ) : (
            draftGroups.map((group) => (
              <PairingGroupCard key={group.id} group={group} isDraft={true} />
            ))
          )}
        </section>
      </section>

      {publishedGroups.length > 0 && (
        <section className={styles.sectionBlock}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionHeading}>
              <h2 className={styles.sectionTitle}>Published groups</h2>
              <p className={styles.sectionIntro}>
                {draftGroups.length > 0
                  ? "Currently live on the public site. A separate draft set already exists, so these groups stay read-only until you publish or clear that draft."
                  : "Currently live on the public site. Unpublish to move these groups back to draft so you can edit them again."}
              </p>
            </div>
            <div className={styles.sectionActionStack}>
              <form
                action={submitUnpublishPairings}
                className={styles.actionOnlyForm}
              >
                <button
                  className={styles.secondaryActionButton}
                  disabled={draftGroups.length > 0}
                  type="submit"
                >
                  Unpublish to draft
                </button>
              </form>
              <p className={styles.sectionActionHint}>
                {draftGroups.length > 0
                  ? "Unpublish is locked while another draft set exists, which avoids mixing live and draft groups."
                  : "The public home page only shows published groups, so unpublishing removes this board until you publish again."}
              </p>
            </div>
          </div>
          <section className={styles.pairingGrid}>
            {publishedGroups.map((group) => (
              <PairingGroupCard key={group.id} group={group} isDraft={false} />
            ))}
          </section>
        </section>
      )}
    </>
  );
}

function PairingGroupCard({
  group,
  isDraft,
}: {
  group: PairingGroupWithMembers;
  isDraft: boolean;
}) {
  return (
    <article className={styles.panel}>
      {isDraft ? (
        <>
          <form action={updatePairingGroup} className={styles.compactForm}>
            <input name="id" type="hidden" value={group.id} />
            <label>
              Name
              <input
                name="name"
                required
                type="text"
                defaultValue={group.name}
              />
            </label>
            <label>
              Sort order
              <input
                min="1"
                name="sortOrder"
                required
                type="number"
                defaultValue={group.sortOrder}
              />
            </label>
            <label>
              Tee time (optional)
              <input
                name="teeTime"
                type="datetime-local"
                defaultValue={datetimeLocalValue(group.teeTime)}
              />
            </label>
            <button className={styles.actionButton} type="submit">
              Save group
            </button>
          </form>
          <div className={styles.pairingGroupActions}>
            <form
              action={deletePairingGroup}
              className={styles.pairingDeleteForm}
            >
              <input name="id" type="hidden" value={group.id} />
              <button
                className={`${styles.dangerButton} ${styles.fullWidthButton}`}
                type="submit"
                disabled={group.members.length > 0}
              >
                Delete group
              </button>
            </form>
          </div>
        </>
      ) : (
        <>
          <h3 className={styles.pairingGroupTitle}>{group.name}</h3>
          <p className={styles.pairingMetaLine}>
            Sort order: {group.sortOrder}
          </p>
        </>
      )}

      <p className={styles.pairingMetaLine}>
        <span className={styles.statusPill}>{group.status}</span>
        {group.teeTime && <> / {formatDateTime(group.teeTime)}</>}
      </p>

      {group.members.length > 0 ? (
        <ul className={styles.pairingMembers}>
          {group.members.map((member) => (
            <li key={member.id}>
              <span className={styles.pairingMemberName}>
                {member.participant.firstName} {member.participant.lastName}
              </span>
              <span className={styles.pairingMemberScore}>
                {member.snapshotScore}
                {isDraft && (
                  <form
                    action={removePairingMember}
                    className={styles.pairingRemoveForm}
                  >
                    <input name="memberId" type="hidden" value={member.id} />
                    <button
                      className={styles.pairingRemoveButton}
                      type="submit"
                      title="Remove from group"
                    >
                      Remove
                    </button>
                  </form>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.pairingEmptyState}>No members yet.</p>
      )}
    </article>
  );
}
