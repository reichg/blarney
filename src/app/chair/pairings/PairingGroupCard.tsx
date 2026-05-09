import {
  deletePairingGroup,
  removePairingMember,
  updatePairingGroup,
} from "@/app/actions/pairings";
import styles from "@/app/chair/chair.module.css";
import { PreviewDetailCard } from "@/app/chair/PreviewDetailCard";
import { formatDateTime } from "@/lib/format";
import type { PairingGroupCardProps, PairingGroupMember } from "./type";

function datetimeLocalValue(value: Date | null) {
  if (!value) {
    return "";
  }

  const offsetMs = value.getTimezoneOffset() * 60 * 1000;
  return new Date(value.getTime() - offsetMs).toISOString().slice(0, 16);
}

function formatMemberMeta(member: PairingGroupMember) {
  return `Age ${member.snapshotAge} | Score ${member.snapshotScore}`;
}

export function PairingGroupCard({ group, isDraft }: PairingGroupCardProps) {
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
            <form action={updatePairingGroup} className={styles.compactForm}>
              <input name="id" type="hidden" value={group.id} />
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
                  defaultValue={datetimeLocalValue(group.teeTime)}
                  name="teeTime"
                  type="datetime-local"
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
                >
                  Delete group
                </button>
              </form>
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
                    <form
                      action={removePairingMember}
                      className={styles.pairingRemoveForm}
                    >
                      <input name="memberId" type="hidden" value={member.id} />
                      <button
                        className={styles.pairingRemoveButton}
                        title="Remove from group"
                        type="submit"
                      >
                        Remove
                      </button>
                    </form>
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
