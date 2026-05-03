import styles from "@/app/chair/chair.module.css";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

async function getFeedback() {
  try {
    return await db.feedback.findMany({ orderBy: { createdAt: "desc" } });
  } catch {
    return [];
  }
}

export default async function ChairFeedbackPage() {
  const feedback = await getFeedback();

  return (
    <>
      <div className={styles.topline}>
        <div>
          <p className="eyebrow">Private</p>
          <h1>Feedback</h1>
        </div>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>From</th>
              <th>Category</th>
              <th>Rating</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody>
            {feedback.map((item) => (
              <tr key={item.id}>
                <td>
                  {item.name ?? "Anonymous"}
                  <br />
                  {item.email ?? ""}
                </td>
                <td>{item.category}</td>
                <td>{item.rating ?? "-"}</td>
                <td>{item.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
