import {
  deletePairingGroup,
  removePairingMember,
  updatePairingGroup,
} from "@/app/actions/pairings";
import styles from "@/app/chair/chair.module.css";
import { ChairActionForm } from "@/app/chair/notices/ChairActionForm";
import { PendingSubmitButton } from "@/app/chair/notices/PendingSubmitButton";
import { PreviewDetailCard } from "@/app/chair/PreviewDetailCard";
import { toEventDateTimeLocalValue } from "@/lib/eventTime";
import { formatDateTime } from "@/lib/format";
import {
  PAIRING_NOTICES,
  PAIRINGS_NOTICE_PARAM,
} from "./pairingNotices";
import type { PairingGroupCardProps, PairingGroupMember } from "./type";

function formatMemberMeta(member: PairingGroupMember) {
  return `Age ${member.snapshotAge} | Score ${member.snapshotScore}`;
}

export function PairingGroupCard({
  group,
  isDraft,
  returnTo,
}: PairingGroupCardProps) {
  const memberSummary = group.members.length
    ? `${group.members.length} golfer${group.members.length === 1 ? "" : "s"}`
    : "No members yet";

  return (
    <PreviewDetailCard
      className={styles.pairingGroupCard}
      eyebrow={isDraft ? "Draft group" : "Published group"}
      openLabel={`Open pairing group details for ${group.name}`}
      preview={
        <>
          <div className={styles.pairingCardTopline}>
            <div>
              <p className={styles.cardKicker}>{group.status}</p>
              <h3 className={styles.cardTitle}>{group.name}</h3>
            </div>
            <span className={styles.statusPill}>{group.status}</span>
          </div>
          <div className={styles.cardMetaGrid}>
            <span className={styles.metric}>
              <span>Sort order</span>
              <strong>{group.sortOrder}</strong>
            </span>
            <span className={styles.metric}>
              <span>Tee time</span>
              <strong>
                {group.teeTime ? formatDateTime(group.teeTime) : "N/A"}
              </strong>
            </span>
          </div>
          {group.members.length > 0 ? (
            <>
              <p className={styles.cardText}>{memberSummary}</p>
              <div className={styles.pairingPreviewMembers}>
                {group.members.map((member) => (
                  <div className={styles.pairingPreviewMember} key={member.id}>
                    <span className={styles.pairingMemberName}>
                      {member.participant.firstName}{" "}
                      {member.participant.lastName}
                    </span>
                    <span className={styles.pairingMemberMeta}>
                      {formatMemberMeta(member)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className={styles.cardText}>{memberSummary}</p>
          )}
        </>
      }
      title={group.name}
    >
      <div className={styles.detailStack}>
        {isDraft ? (
          <>
            <ChairActionForm
              action={updatePairingGroup}
              className={styles.compactForm}
              notices={PAIRING_NOTICES}
              param={PAIRINGS_NOTICE_PARAM}
            >
              <input name="id" type="hidden" value={group.id} />
              {returnTo ? (
                <input name="returnTo" type="hidden" value={returnTo} />
              ) : null}
              <label>
                Name
                <input
                  defaultValue={group.name}
                  name="name"
                  required
                  type="text"
                />
              </label>
              <label>
                Sort order
                <input
                  defaultValue={group.sortOrder}
                  min="1"
                  name="sortOrder"
                  required
                  type="number"
                />
              </label>
              <label>
                Tee time (optional)
                <input
                  defaultValue={toEventDateTimeLocalValue(group.teeTime)}
                  name="teeTime"
                  type="datetime-local"
                />
              </label>
              <PendingSubmitButton
                className={styles.actionButton}
                pendingLabel="Saving…"
              >
                Save group
              </PendingSubmitButton>
            </ChairActionForm>
            <div className={styles.pairingGroupActions}>
              <ChairActionForm
                action={deletePairingGroup}
                className={styles.pairingDeleteForm}
                notices={PAIRING_NOTICES}
                param={PAIRINGS_NOTICE_PARAM}
              >
                <input name="id" type="hidden" value={group.id} />
                {returnTo ? (
                  <input name="returnTo" type="hidden" value={returnTo} />
                ) : null}
                <PendingSubmitButton
                  className={`${styles.dangerButton} ${styles.fullWidthButton}`}
                  pendingLabel="Deleting…"
                >
                  Delete group
                </PendingSubmitButton>
              </ChairActionForm>
            </div>
          </>
        ) : (
          <div className={styles.detailGrid}>
            <div className={styles.detailItem}>
              <span>Sort order</span>
              <p>{group.sortOrder}</p>
            </div>
            <div className={styles.detailItem}>
              <span>Tee time</span>
              <p>{group.teeTime ? formatDateTime(group.teeTime) : "N/A"}</p>
            </div>
          </div>
        )}
        {group.members.length > 0 ? (
          <ul className={styles.pairingMembers}>
            {group.members.map((member) => (
              <li key={member.id}>
                <span className={styles.pairingMemberName}>
                  {member.participant.firstName} {member.participant.lastName}
                </span>
                <span className={styles.pairingMemberScore}>
                  <span className={styles.pairingMemberMeta}>
                    {formatMemberMeta(member)}
                  </span>
                  {isDraft ? (
                    <ChairActionForm
                      action={removePairingMember}
                      className={styles.pairingRemoveForm}
                      notices={PAIRING_NOTICES}
                      param={PAIRINGS_NOTICE_PARAM}
                    >
                      <input name="memberId" type="hidden" value={member.id} />
                      {returnTo ? (
                        <input name="returnTo" type="hidden" value={returnTo} />
                      ) : null}
                      <PendingSubmitButton
                        className={styles.pairingRemoveButton}
                        pendingLabel="Removing…"
                      >
                        Remove
                      </PendingSubmitButton>
                    </ChairActionForm>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.pairingEmptyState}>No members yet.</p>
        )}
      </div>
    </PreviewDetailCard>
  );
}
