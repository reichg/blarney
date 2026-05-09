import type {
  ChairRsvpPartyCounts,
  ChairRsvpPartyCountsInput,
} from "@/lib/type";

export type {
  ChairRsvpPartyCounts,
  ChairRsvpPartyCountsInput,
} from "@/lib/type";

export function getChairRsvpPartyCounts(
  rsvp: ChairRsvpPartyCountsInput,
): ChairRsvpPartyCounts | null {
  if (rsvp.adultAttendeeCount !== null && rsvp.childAttendeeCount !== null) {
    return {
      adultAttendeeCount: rsvp.adultAttendeeCount,
      childAttendeeCount: rsvp.childAttendeeCount,
      attendeeCount: rsvp.attendeeCount,
    };
  }

  const registration = rsvp.participant?.registrations[0];

  if (
    rsvp.source === "REGISTRATION" &&
    registration &&
    typeof rsvp.participant?.age === "number"
  ) {
    const golferIsAdult = rsvp.participant.age >= 15;

    return {
      adultAttendeeCount:
        registration.adultGuestCount + (golferIsAdult ? 1 : 0),
      childAttendeeCount:
        registration.childGuestCount + (golferIsAdult ? 0 : 1),
      attendeeCount: rsvp.attendeeCount,
    };
  }

  if (rsvp.attendeeCount === 0) {
    return {
      adultAttendeeCount: 0,
      childAttendeeCount: 0,
      attendeeCount: 0,
    };
  }

  return null;
}

export function sumChairRsvpPartyCounts(
  rsvps: ReadonlyArray<ChairRsvpPartyCountsInput>,
) {
  return rsvps.reduce<ChairRsvpPartyCounts>(
    (totals, rsvp) => {
      const partyCounts = getChairRsvpPartyCounts(rsvp);

      if (!partyCounts) {
        return totals;
      }

      return {
        adultAttendeeCount:
          totals.adultAttendeeCount + partyCounts.adultAttendeeCount,
        childAttendeeCount:
          totals.childAttendeeCount + partyCounts.childAttendeeCount,
        attendeeCount: totals.attendeeCount + partyCounts.attendeeCount,
      };
    },
    {
      adultAttendeeCount: 0,
      childAttendeeCount: 0,
      attendeeCount: 0,
    },
  );
}
