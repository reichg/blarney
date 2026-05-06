import {
  getChairRsvpPartyCounts,
  sumChairRsvpPartyCounts,
  type ChairRsvpPartyCountsInput,
} from "@/lib/chairRsvps";
import { describe, expect, it } from "vitest";

function buildRsvp(
  overrides: Partial<ChairRsvpPartyCountsInput> = {},
): ChairRsvpPartyCountsInput {
  return {
    source: "FORM",
    adultAttendeeCount: 2,
    childAttendeeCount: 1,
    attendeeCount: 3,
    participant: null,
    ...overrides,
  };
}

describe("getChairRsvpPartyCounts", () => {
  it("returns explicit adult and kid counts when they exist on the RSVP", () => {
    expect(getChairRsvpPartyCounts(buildRsvp())).toEqual({
      adultAttendeeCount: 2,
      childAttendeeCount: 1,
      attendeeCount: 3,
    });
  });

  it("derives registration-sourced counts from the golfer age and guest counts", () => {
    expect(
      getChairRsvpPartyCounts(
        buildRsvp({
          source: "REGISTRATION",
          adultAttendeeCount: null,
          childAttendeeCount: null,
          attendeeCount: 2,
          participant: {
            age: 13,
            registrations: [{ adultGuestCount: 1, childGuestCount: 0 }],
          },
        }),
      ),
    ).toEqual({
      adultAttendeeCount: 1,
      childAttendeeCount: 1,
      attendeeCount: 2,
    });
  });

  it("treats a zero-attendee RSVP with no split counts as zero adults and kids", () => {
    expect(
      getChairRsvpPartyCounts(
        buildRsvp({
          adultAttendeeCount: null,
          childAttendeeCount: null,
          attendeeCount: 0,
        }),
      ),
    ).toEqual({
      adultAttendeeCount: 0,
      childAttendeeCount: 0,
      attendeeCount: 0,
    });
  });

  it("returns null when a positive-attendee RSVP cannot be split into adults and kids", () => {
    expect(
      getChairRsvpPartyCounts(
        buildRsvp({
          adultAttendeeCount: null,
          childAttendeeCount: null,
          attendeeCount: 2,
        }),
      ),
    ).toBeNull();
  });
});

describe("sumChairRsvpPartyCounts", () => {
  it("sums normalized adult and kid totals across explicit and derived RSVP rows", () => {
    expect(
      sumChairRsvpPartyCounts([
        buildRsvp(),
        buildRsvp({
          source: "REGISTRATION",
          adultAttendeeCount: null,
          childAttendeeCount: null,
          attendeeCount: 2,
          participant: {
            age: 42,
            registrations: [{ adultGuestCount: 1, childGuestCount: 0 }],
          },
        }),
        buildRsvp({
          source: "REGISTRATION",
          adultAttendeeCount: null,
          childAttendeeCount: null,
          attendeeCount: 2,
          participant: {
            age: 13,
            registrations: [{ adultGuestCount: 0, childGuestCount: 1 }],
          },
        }),
        buildRsvp({
          adultAttendeeCount: null,
          childAttendeeCount: null,
          attendeeCount: 0,
        }),
        buildRsvp({
          adultAttendeeCount: null,
          childAttendeeCount: null,
          attendeeCount: 4,
        }),
      ]),
    ).toEqual({
      adultAttendeeCount: 4,
      childAttendeeCount: 3,
      attendeeCount: 7,
    });
  });
});
