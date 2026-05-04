import styles from "@/app/chair/chair.module.css";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function formatGuestSummary(adultGuestCount: number, childGuestCount: number) {
  if (adultGuestCount === 0 && childGuestCount === 0) {
    return "None";
  }

  const parts = [];

  if (adultGuestCount > 0) {
    parts.push(`${adultGuestCount} adult${adultGuestCount === 1 ? "" : "s"}`);
  }

  if (childGuestCount > 0) {
    parts.push(`${childGuestCount} child${childGuestCount === 1 ? "" : "ren"}`);
  }

  return parts.join(", ");
}

function formatPaymentStatus(paymentStatus: string) {
  if (paymentStatus === "EXTERNAL_PENDING") {
    return "Pending payment";
  }

  if (paymentStatus === "CONFIRMED") {
    return "Complete";
  }

  if (paymentStatus === "WAIVED") {
    return "Complete (waived)";
  }

  return paymentStatus.replaceAll("_", " ");
}

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
              <th>Status</th>
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
                <td>
                  {formatGuestSummary(
                    registration.adultGuestCount,
                    registration.childGuestCount,
                  )}
                </td>
                <td>
                  <span className={styles.statusPill}>
                    {formatPaymentStatus(registration.paymentStatus)}
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
