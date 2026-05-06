import { assignPairingMember } from "@/app/actions/pairings";
import { PreviewDetailCard } from "@/app/chair/PreviewDetailCard";
import styles from "@/app/chair/chair.module.css";

type PairingOption = {
  id: string;
  label: string;
  disabled: boolean;
};

type PairingGolferCardProps = {
  golfer: {
    id: string;
    firstName: string;
    lastName: string;
    age: number;
    gender: string;
    averageScore: number;
    draftAssignment: {
      groupId: string;
      groupName: string;
    } | null;
  };
  groupOptions: PairingOption[];
};

export function PairingGolferCard({
  golfer,
  groupOptions,
}: PairingGolferCardProps) {
  const fullName = `${golfer.firstName} ${golfer.lastName}`;
  const assignmentLabel = golfer.draftAssignment?.groupName ?? "Available";

  return (
    <PreviewDetailCard
      className={styles.pairingGolferCard}
      eyebrow="Golfer"
      key={golfer.id}
      openLabel={`Open pairing details for ${fullName}`}
      preview={
        <>
          <div className={styles.pairingCardTopline}>
            <div>
              <p className={styles.cardKicker}>
                {golfer.draftAssignment ? "Assigned" : "Available"}
              </p>
              <h3 className={styles.cardTitle}>{fullName}</h3>
            </div>
            <span className={styles.statusPill}>{assignmentLabel}</span>
          </div>
          <div className={styles.cardMetaGrid}>
            <span className={styles.metric}>
              <span>Age</span>
              <strong>{golfer.age}</strong>
            </span>
            <span className={styles.metric}>
              <span>Gender</span>
              <strong>{golfer.gender}</strong>
            </span>
            <span className={styles.metric}>
              <span>Score</span>
              <strong>{golfer.averageScore}</strong>
            </span>
            <span className={styles.metric}>
              <span>Draft group</span>
              <strong>{assignmentLabel}</strong>
            </span>
          </div>
        </>
      }
      title={fullName}
    >
      <div className={styles.detailStack}>
        <div className={styles.detailGrid}>
          <div className={styles.detailItem}>
            <span>Age</span>
            <p>{golfer.age}</p>
          </div>
          <div className={styles.detailItem}>
            <span>Gender</span>
            <p>{golfer.gender}</p>
          </div>
          <div className={styles.detailItem}>
            <span>Average score</span>
            <p>{golfer.averageScore}</p>
          </div>
          <div className={styles.detailItem}>
            <span>Draft group</span>
            <p>{assignmentLabel}</p>
          </div>
        </div>
        {groupOptions.length > 0 ? (
          <form action={assignPairingMember} className={styles.compactForm}>
            <input name="participantId" type="hidden" value={golfer.id} />
            <label>
              {golfer.draftAssignment
                ? "Move to another draft group"
                : "Assign to draft group"}
              <select
                name="groupId"
                required
                defaultValue={golfer.draftAssignment?.groupId ?? ""}
              >
                <option value="">Select group</option>
                {groupOptions.map((group) => (
                  <option
                    disabled={group.disabled}
                    key={group.id}
                    value={group.id}
                  >
                    {group.label}
                  </option>
                ))}
              </select>
            </label>
            <button className={styles.actionButton} type="submit">
              {golfer.draftAssignment ? "Move" : "Assign"}
            </button>
          </form>
        ) : (
          <span className={styles.muted}>No draft groups</span>
        )}
      </div>
    </PreviewDetailCard>
  );
}
