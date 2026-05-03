import styles from "@/app/chair/chair.module.css";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

async function getRegistrations() {
  try {
    return await db.registration.findMany({
      include: { participant: true },
      orderBy: { createdAt: "desc" },
    });
  } catch {
    return [];
  }
}

export default async function ChairRegistrationsPage() {
  const registrations = await getRegistrations();

  return (
    <>
      <div className={styles.topline}>
        <div>
          <p className="eyebrow">Private</p>
          <h1>Registrations</h1>
        </div>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Contact</th>
              <th>Golf</th>
              <th>Package</th>
              <th>Guests</th>
              <th>Payment</th>
            </tr>
          </thead>
          <tbody>
            {registrations.map((registration) => (
              <tr key={registration.id}>
                <td>
                  {registration.participant.firstName}{" "}
                  {registration.participant.lastName}
                </td>
                <td>
                  {registration.participant.email}
                  <br />
                  {registration.participant.phone ?? ""}
                </td>
                <td>
                  {registration.participant.gender.replaceAll("_", " ")}
                  <br />
                  Age {registration.participant.age}, score{" "}
                  {registration.participant.averageScore}
                </td>
                <td>{registration.packageSelection}</td>
                <td>{registration.guestCount}</td>
                <td>
                  <span className={styles.statusPill}>
                    {registration.paymentStatus.replaceAll("_", " ")}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
