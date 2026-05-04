import {
  generatePairings,
  publishPairings,
  updatePairingGroup,
} from "@/app/actions/pairings";
import styles from "@/app/chair/chair.module.css";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

function datetimeLocalValue(value: Date | null) {
  if (!value) {
    return "";
  }

  const offsetMs = value.getTimezoneOffset() * 60 * 1000;
  return new Date(value.getTime() - offsetMs).toISOString().slice(0, 16);
}

async function getPairings() {
  try {
    const [groups, participantCount] = await Promise.all([
      db.pairingGroup.findMany({
        include: {
          members: {
            include: { participant: true },
            orderBy: { slot: "asc" },
          },
        },
        orderBy: [{ status: "asc" }, { sortOrder: "asc" }],
      }),
      db.participant.count({
        where: {
          registrations: {
            some: {},
          },
        },
      }),
    ]);

    return { groups, participantCount };
  } catch {
    return { groups: [], participantCount: 0 };
  }
}

export default async function ChairPairingsPage() {
  const { groups, participantCount } = await getPairings();
  const draftCount = groups.filter((group) => group.status === "DRAFT").length;

  return (
    <>
      <div className={styles.topline}>
        <div>
          <p className="eyebrow">Private</p>
          <h1>Pairings</h1>
          <p className={styles.muted}>
            {participantCount} registered participants available for pairing.
          </p>
        </div>
        <div className={styles.actions}>
          <form action={generatePairings}>
            <button className={styles.actionButton} type="submit">
              Generate draft
            </button>
          </form>
          <form action={publishPairings}>
            <button
              className={styles.actionButton}
              disabled={!draftCount}
              type="submit"
            >
              Publish draft
            </button>
          </form>
        </div>
      </div>
      <section className={styles.pairingGrid}>
        {groups.map((group) => (
          <article className={styles.panel} key={group.id}>
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
                Tee time
                <input
                  required
                  name="teeTime"
                  type="datetime-local"
                  defaultValue={datetimeLocalValue(group.teeTime)}
                />
              </label>
              <button className={styles.actionButton} type="submit">
                Save group
              </button>
            </form>
            <p className={styles.muted}>
              <span className={styles.statusPill}>{group.status}</span> ·{" "}
              {formatDateTime(group.teeTime)}
            </p>
            <ul className={styles.pairingMembers}>
              {group.members.map((member) => (
                <li key={member.id}>
                  <span>
                    {member.participant.firstName} {member.participant.lastName}
                  </span>
                  <span>{member.snapshotScore}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </>
  );
}
