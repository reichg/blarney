import styles from "@/app/chair/chair.module.css";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

async function getRsvps() {
  try {
    return await db.rsvp.findMany({ orderBy: { createdAt: "desc" } });
  } catch {
    return [];
  }
}

export default async function ChairRsvpsPage() {
  const rsvps = await getRsvps();

  return (
    <>
      <div className={styles.topline}>
        <div>
          <p className="eyebrow">Private</p>
          <h1>RSVPs</h1>
        </div>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Status</th>
              <th>Count</th>
              <th>Family</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {rsvps.map((rsvp) => (
              <tr key={rsvp.id}>
                <td>
                  {rsvp.firstName} {rsvp.lastName}
                </td>
                <td>{rsvp.email}</td>
                <td>
                  <span className={styles.statusPill}>
                    {rsvp.attending ? "Attending" : "Not attending"}
                  </span>
                </td>
                <td>{rsvp.attendeeCount}</td>
                <td>{rsvp.familyNames}</td>
                <td>
                  {rsvp.dietaryNotes}
                  {rsvp.notes ? <p>{rsvp.notes}</p> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
