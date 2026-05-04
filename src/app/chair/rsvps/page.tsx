import styles from "@/app/chair/chair.module.css";
import { db } from "@/lib/db";
import type { RsvpSource } from "@prisma/client";

export const dynamic = "force-dynamic";

async function getRsvps() {
  try {
    return await db.rsvp.findMany({
      include: {
        participant: {
          select: {
            age: true,
            registrations: {
              orderBy: { createdAt: "desc" },
              select: {
                adultGuestCount: true,
                childGuestCount: true,
              },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  } catch {
    return [];
  }
}

function formatRsvpSource(source: RsvpSource): string {
  return source === "FORM" ? "RSVP form" : "Registration";
}

function formatGuestSummary(adultGuestCount: number, childGuestCount: number) {
  return `Adults: ${adultGuestCount}, Children: ${childGuestCount}`;
}

function formatAttendeeTotal(attendeeCount: number) {
  if (attendeeCount === 0) {
    return "No attendees";
  }

  return `${attendeeCount} total attendee${attendeeCount === 1 ? "" : "s"}`;
}

function formatPartySummary(
  rsvp: Awaited<ReturnType<typeof getRsvps>>[number],
) {
  if (rsvp.adultAttendeeCount !== null && rsvp.childAttendeeCount !== null) {
    return {
      primary: formatGuestSummary(
        rsvp.adultAttendeeCount,
        rsvp.childAttendeeCount,
      ),
      secondary:
        rsvp.attendeeCount === 0
          ? undefined
          : formatAttendeeTotal(rsvp.attendeeCount),
    };
  }

  const registration = rsvp.participant?.registrations[0];

  if (rsvp.source === "REGISTRATION" && registration) {
    if (typeof rsvp.participant?.age === "number") {
      const golferIsAdult = rsvp.participant.age >= 18;
      const adultAttendeeCount =
        registration.adultGuestCount + (golferIsAdult ? 1 : 0);
      const childAttendeeCount =
        registration.childGuestCount + (golferIsAdult ? 0 : 1);

      return {
        primary: formatGuestSummary(adultAttendeeCount, childAttendeeCount),
        secondary: formatAttendeeTotal(rsvp.attendeeCount),
      };
    }

    return {
      primary: `${formatGuestSummary(registration.adultGuestCount, registration.childGuestCount)}, plus registrant`,
      secondary: formatAttendeeTotal(rsvp.attendeeCount),
    };
  }

  return {
    primary: formatAttendeeTotal(rsvp.attendeeCount),
  };
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
              <th>Source</th>
              <th>Party</th>
              <th>Family</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {rsvps.length === 0 ? (
              <tr>
                <td colSpan={7} className={styles.muted}>
                  No RSVPs yet.
                </td>
              </tr>
            ) : (
              rsvps.map((rsvp) => {
                const partySummary = formatPartySummary(rsvp);

                return (
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
                    <td>{formatRsvpSource(rsvp.source)}</td>
                    <td>
                      <div>{partySummary.primary}</div>
                      {partySummary.secondary ? (
                        <div className={styles.muted}>
                          {partySummary.secondary}
                        </div>
                      ) : null}
                    </td>
                    <td>{rsvp.familyNames}</td>
                    <td>
                      {rsvp.dietaryNotes}
                      {rsvp.notes ? <p>{rsvp.notes}</p> : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
