import { submitRsvp } from "@/app/actions/rsvp";
import { afterEach, describe, expect, it, vi } from "vitest";

const {
  participantFindUnique,
  registrationFindFirst,
  rsvpCreate,
  rsvpFindUnique,
  rsvpUpdate,
} = vi.hoisted(() => ({
  participantFindUnique: vi.fn(),
  registrationFindFirst: vi.fn(),
  rsvpCreate: vi.fn(),
  rsvpFindUnique: vi.fn(),
  rsvpUpdate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    participant: {
      findUnique: participantFindUnique,
    },
    registration: {
      findFirst: registrationFindFirst,
    },
    rsvp: {
      create: rsvpCreate,
      findUnique: rsvpFindUnique,
      update: rsvpUpdate,
    },
  },
}));

function buildFormData(overrides: Record<string, string | undefined> = {}) {
  const formData = new FormData();
  const values = {
    firstName: "Pat",
    lastName: "Golfer",
    email: "Pat@example.com",
    attending: "yes",
    adultAttendeeCount: "2",
    childAttendeeCount: "1",
    familyNames: "Pat and family",
    dietaryNotes: "None",
    notes: "Looking forward to it",
    ...overrides,
  };

  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) {
      formData.set(key, value);
    }
  }

  return formData;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("submitRsvp", () => {
  it("creates one FORM RSVP for a fresh normalized email", async () => {
    registrationFindFirst.mockResolvedValue(null);
    rsvpFindUnique.mockResolvedValue(null);
    participantFindUnique.mockResolvedValue({ id: "participant-1" });
    rsvpCreate.mockResolvedValue({ id: "rsvp-form-1" });

    await expect(submitRsvp(buildFormData())).resolves.toEqual({
      ok: true,
      thanksPath: "/rsvp/thanks",
    });

    expect(registrationFindFirst).toHaveBeenCalledWith({
      where: {
        participant: {
          email: "pat@example.com",
        },
      },
      select: { id: true },
    });
    expect(rsvpFindUnique).toHaveBeenCalledWith({
      where: { email: "pat@example.com" },
      select: { id: true },
    });
    expect(participantFindUnique).toHaveBeenCalledWith({
      where: { email: "pat@example.com" },
    });
    expect(rsvpCreate).toHaveBeenCalledWith({
      data: {
        participantId: "participant-1",
        source: "FORM",
        firstName: "Pat",
        lastName: "Golfer",
        email: "pat@example.com",
        attending: true,
        adultAttendeeCount: 2,
        childAttendeeCount: 1,
        attendeeCount: 3,
        familyNames: "Pat and family",
        dietaryNotes: "None",
        notes: "Looking forward to it",
      },
    });
    expect(rsvpUpdate).not.toHaveBeenCalled();
  });

  it("rejects a duplicate when a registration already exists for the email", async () => {
    registrationFindFirst.mockResolvedValue({ id: "registration-1" });

    await expect(submitRsvp(buildFormData())).resolves.toEqual({
      ok: false,
      reason: "duplicate",
      error: "This email already has a registration or RSVP on file.",
    });

    expect(registrationFindFirst).toHaveBeenCalledWith({
      where: {
        participant: {
          email: "pat@example.com",
        },
      },
      select: { id: true },
    });
    expect(rsvpFindUnique).not.toHaveBeenCalled();
    expect(participantFindUnique).not.toHaveBeenCalled();
    expect(rsvpCreate).not.toHaveBeenCalled();
    expect(rsvpUpdate).not.toHaveBeenCalled();
  });

  it("rejects a duplicate when a FORM RSVP already exists for the email", async () => {
    registrationFindFirst.mockResolvedValue(null);
    rsvpFindUnique.mockResolvedValue({ id: "rsvp-form-1", source: "FORM" });

    await expect(submitRsvp(buildFormData())).resolves.toEqual({
      ok: false,
      reason: "duplicate",
      error: "This email already has a registration or RSVP on file.",
    });

    expect(rsvpFindUnique).toHaveBeenCalledWith({
      where: { email: "pat@example.com" },
      select: { id: true },
    });
    expect(participantFindUnique).not.toHaveBeenCalled();
    expect(rsvpCreate).not.toHaveBeenCalled();
    expect(rsvpUpdate).not.toHaveBeenCalled();
  });

  it("rejects a duplicate when a REGISTRATION RSVP already exists for the email", async () => {
    registrationFindFirst.mockResolvedValue(null);
    rsvpFindUnique.mockResolvedValue({
      id: "rsvp-registration-1",
      source: "REGISTRATION",
    });

    await expect(submitRsvp(buildFormData())).resolves.toEqual({
      ok: false,
      reason: "duplicate",
      error: "This email already has a registration or RSVP on file.",
    });

    expect(rsvpFindUnique).toHaveBeenCalledWith({
      where: { email: "pat@example.com" },
      select: { id: true },
    });
    expect(participantFindUnique).not.toHaveBeenCalled();
    expect(rsvpCreate).not.toHaveBeenCalled();
    expect(rsvpUpdate).not.toHaveBeenCalled();
  });

  it("returns an invalid result without writing when required input is invalid", async () => {
    await expect(
      submitRsvp(buildFormData({ email: "not-an-email" })),
    ).resolves.toEqual({
      ok: false,
      reason: "invalid",
      error: "Complete the required RSVP details and try again.",
    });

    expect(registrationFindFirst).not.toHaveBeenCalled();
    expect(rsvpFindUnique).not.toHaveBeenCalled();
    expect(participantFindUnique).not.toHaveBeenCalled();
    expect(rsvpCreate).not.toHaveBeenCalled();
    expect(rsvpUpdate).not.toHaveBeenCalled();
  });

  it.each([
    {
      description: "attendance is missing",
      overrides: { attending: undefined },
    },
    {
      description: "adult attendee count is missing",
      overrides: { adultAttendeeCount: undefined },
    },
    {
      description: "child attendee count is missing",
      overrides: { childAttendeeCount: undefined },
    },
    { description: "family names are blank", overrides: { familyNames: "" } },
    { description: "dietary notes are blank", overrides: { dietaryNotes: "" } },
    { description: "other notes are blank", overrides: { notes: "" } },
  ])("returns an invalid result when $description", async ({ overrides }) => {
    await expect(submitRsvp(buildFormData(overrides))).resolves.toEqual({
      ok: false,
      reason: "invalid",
      error: "Complete the required RSVP details and try again.",
    });

    expect(registrationFindFirst).not.toHaveBeenCalled();
    expect(rsvpFindUnique).not.toHaveBeenCalled();
    expect(participantFindUnique).not.toHaveBeenCalled();
    expect(rsvpCreate).not.toHaveBeenCalled();
    expect(rsvpUpdate).not.toHaveBeenCalled();
  });

  it("returns an invalid result when attending has no party count", async () => {
    await expect(
      submitRsvp(
        buildFormData({ adultAttendeeCount: "0", childAttendeeCount: "0" }),
      ),
    ).resolves.toEqual({
      ok: false,
      reason: "invalid",
      error: "Complete the required RSVP details and try again.",
    });

    expect(registrationFindFirst).not.toHaveBeenCalled();
    expect(rsvpFindUnique).not.toHaveBeenCalled();
    expect(participantFindUnique).not.toHaveBeenCalled();
    expect(rsvpCreate).not.toHaveBeenCalled();
    expect(rsvpUpdate).not.toHaveBeenCalled();
  });

  it("returns an invalid result when not attending still has attendees", async () => {
    await expect(
      submitRsvp(
        buildFormData({
          attending: "no",
          adultAttendeeCount: "1",
          childAttendeeCount: "0",
        }),
      ),
    ).resolves.toEqual({
      ok: false,
      reason: "invalid",
      error: "Complete the required RSVP details and try again.",
    });

    expect(registrationFindFirst).not.toHaveBeenCalled();
    expect(rsvpFindUnique).not.toHaveBeenCalled();
    expect(participantFindUnique).not.toHaveBeenCalled();
    expect(rsvpCreate).not.toHaveBeenCalled();
    expect(rsvpUpdate).not.toHaveBeenCalled();
  });

  it("creates a fresh RSVP without calling update when no participant exists", async () => {
    registrationFindFirst.mockResolvedValue(null);
    rsvpFindUnique.mockResolvedValue(null);
    participantFindUnique.mockResolvedValue(null);
    rsvpCreate.mockResolvedValue({ id: "rsvp-form-1" });

    await expect(submitRsvp(buildFormData())).resolves.toEqual({
      ok: true,
      thanksPath: "/rsvp/thanks",
    });

    expect(rsvpCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        participantId: null,
        source: "FORM",
        email: "pat@example.com",
      }),
    });
    expect(rsvpUpdate).not.toHaveBeenCalled();
  });
});
