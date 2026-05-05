import { submitRsvp } from "@/app/actions/rsvp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  createRsvpCheckoutPayment,
  participantFindUnique,
  registrationCheckoutFindFirst,
  registrationFindFirst,
  rsvpCheckoutFindFirst,
  rsvpCreate,
  rsvpFindUnique,
  rsvpUpdate,
} = vi.hoisted(() => ({
  createRsvpCheckoutPayment: vi.fn(),
  participantFindUnique: vi.fn(),
  registrationCheckoutFindFirst: vi.fn(),
  registrationFindFirst: vi.fn(),
  rsvpCheckoutFindFirst: vi.fn(),
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
    registrationCheckout: {
      findFirst: registrationCheckoutFindFirst,
    },
    rsvpCheckout: {
      findFirst: rsvpCheckoutFindFirst,
    },
    rsvp: {
      create: rsvpCreate,
      findUnique: rsvpFindUnique,
      update: rsvpUpdate,
    },
  },
}));

vi.mock("@/lib/payment", () => ({
  getRsvpCheckoutPaymentPath: (checkoutId: string) =>
    `/register/payment?rsvpCheckout=${encodeURIComponent(checkoutId)}`,
}));

vi.mock("@/lib/rsvpCheckout", () => ({
  createRsvpCheckoutPayment,
  rsvpCheckoutPayloadSchema: {
    parse: (value: unknown) => value,
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

beforeEach(() => {
  registrationCheckoutFindFirst.mockResolvedValue(null);
  rsvpCheckoutFindFirst.mockResolvedValue(null);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("submitRsvp", () => {
  it("starts a paid RSVP checkout for a fresh attending email", async () => {
    registrationFindFirst.mockResolvedValue(null);
    rsvpFindUnique.mockResolvedValue(null);
    createRsvpCheckoutPayment.mockResolvedValue({
      ok: true,
      status: "pending",
      checkoutId: "rsvp-checkout-1",
      paymentReference: "payment-link-1",
      paymentUrl: "https://square.link/u/rsvp-checkout-1",
    });

    await expect(submitRsvp(buildFormData())).resolves.toEqual({
      ok: true,
      requiresPayment: true,
      checkoutId: "rsvp-checkout-1",
      checkoutUrl: "https://square.link/u/rsvp-checkout-1",
      paymentUrl: "https://square.link/u/rsvp-checkout-1",
      paymentPath: "/register/payment?rsvpCheckout=rsvp-checkout-1",
      thanksPath: "/rsvp/thanks?rsvpCheckout=rsvp-checkout-1",
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
    expect(registrationCheckoutFindFirst).toHaveBeenCalledWith({
      where: {
        email: "pat@example.com",
        status: { in: ["PENDING", "PAYMENT_REVIEW"] },
      },
      select: { id: true },
    });
    expect(createRsvpCheckoutPayment).toHaveBeenCalledWith({
      firstName: "Pat",
      lastName: "Golfer",
      email: "pat@example.com",
      adultAttendeeCount: 2,
      childAttendeeCount: 1,
      familyNames: "Pat and family",
      dietaryNotes: "None",
      notes: "Looking forward to it",
    });
    expect(participantFindUnique).not.toHaveBeenCalled();
    expect(rsvpCreate).not.toHaveBeenCalled();
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
    expect(registrationCheckoutFindFirst).toHaveBeenCalledWith({
      where: {
        email: "pat@example.com",
        status: "CONFIRMED",
      },
      select: { id: true },
    });
    expect(rsvpCheckoutFindFirst).not.toHaveBeenCalled();
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
    expect(registrationCheckoutFindFirst).toHaveBeenCalledWith({
      where: {
        email: "pat@example.com",
        status: "CONFIRMED",
      },
      select: { id: true },
    });
    expect(rsvpCheckoutFindFirst).not.toHaveBeenCalled();
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
    expect(registrationCheckoutFindFirst).toHaveBeenCalledWith({
      where: {
        email: "pat@example.com",
        status: "CONFIRMED",
      },
      select: { id: true },
    });
    expect(rsvpCheckoutFindFirst).not.toHaveBeenCalled();
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
    expect(registrationCheckoutFindFirst).not.toHaveBeenCalled();
    expect(rsvpCheckoutFindFirst).not.toHaveBeenCalled();
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
    expect(registrationCheckoutFindFirst).not.toHaveBeenCalled();
    expect(rsvpCheckoutFindFirst).not.toHaveBeenCalled();
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
    expect(registrationCheckoutFindFirst).not.toHaveBeenCalled();
    expect(rsvpCheckoutFindFirst).not.toHaveBeenCalled();
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
    expect(registrationCheckoutFindFirst).not.toHaveBeenCalled();
    expect(rsvpCheckoutFindFirst).not.toHaveBeenCalled();
    expect(participantFindUnique).not.toHaveBeenCalled();
    expect(rsvpCreate).not.toHaveBeenCalled();
    expect(rsvpUpdate).not.toHaveBeenCalled();
  });

  it("rejects a duplicate when an active golf checkout already exists for the email", async () => {
    registrationFindFirst.mockResolvedValue(null);
    rsvpFindUnique.mockResolvedValue(null);
    registrationCheckoutFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "checkout-1" });

    await expect(submitRsvp(buildFormData())).resolves.toEqual({
      ok: false,
      reason: "duplicate",
      error:
        "This email already has a pending golf registration checkout. Resume checkout or contact the chair before sending an RSVP.",
    });

    expect(registrationCheckoutFindFirst).toHaveBeenCalledWith({
      where: {
        email: "pat@example.com",
        status: { in: ["PENDING", "PAYMENT_REVIEW"] },
      },
      select: { id: true },
    });
    expect(participantFindUnique).not.toHaveBeenCalled();
    expect(rsvpCheckoutFindFirst).not.toHaveBeenCalled();
    expect(rsvpCreate).not.toHaveBeenCalled();
    expect(rsvpUpdate).not.toHaveBeenCalled();
  });

  it("returns a confirmed RSVP thanks path when a reused RSVP checkout is already confirmed", async () => {
    registrationFindFirst.mockResolvedValue(null);
    rsvpFindUnique.mockResolvedValue(null);
    createRsvpCheckoutPayment.mockResolvedValue({
      ok: true,
      status: "confirmed",
      checkoutId: "rsvp-checkout-1",
      rsvpId: "rsvp-form-1",
      paymentUrl: null,
    });

    await expect(submitRsvp(buildFormData())).resolves.toEqual({
      ok: true,
      requiresPayment: true,
      checkoutId: "rsvp-checkout-1",
      checkoutUrl: "/rsvp/thanks?rsvp=rsvp-form-1&payment=confirmed",
      paymentUrl: "/rsvp/thanks?rsvp=rsvp-form-1&payment=confirmed",
      paymentPath: "/rsvp/thanks?rsvp=rsvp-form-1&payment=confirmed",
      thanksPath: "/rsvp/thanks?rsvp=rsvp-form-1&payment=confirmed",
      rsvpId: "rsvp-form-1",
      alreadyConfirmed: true,
    });

    expect(rsvpCreate).not.toHaveBeenCalled();
  });

  it("creates a not-attending RSVP without placeholder BBQ details", async () => {
    registrationFindFirst.mockResolvedValue(null);
    rsvpFindUnique.mockResolvedValue(null);
    participantFindUnique.mockResolvedValue(null);
    rsvpCreate.mockResolvedValue({ id: "rsvp-form-1" });

    await expect(
      submitRsvp(
        buildFormData({
          attending: "no",
          adultAttendeeCount: "0",
          childAttendeeCount: "0",
          familyNames: undefined,
          dietaryNotes: undefined,
          notes: undefined,
        }),
      ),
    ).resolves.toEqual({
      ok: true,
      thanksPath: "/rsvp/thanks",
    });

    expect(rsvpCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        attending: false,
        adultAttendeeCount: 0,
        childAttendeeCount: 0,
        attendeeCount: 0,
        familyNames: null,
        dietaryNotes: null,
        notes: null,
      }),
    });
    expect(rsvpCheckoutFindFirst).toHaveBeenCalledWith({
      where: {
        email: "pat@example.com",
        status: { in: ["PENDING", "PAYMENT_REVIEW"] },
      },
      select: { id: true },
    });
    expect(rsvpUpdate).not.toHaveBeenCalled();
  });

  it("rejects a not-attending RSVP when an active RSVP checkout already exists", async () => {
    registrationFindFirst.mockResolvedValue(null);
    rsvpFindUnique.mockResolvedValue(null);
    rsvpCheckoutFindFirst.mockResolvedValue({ id: "rsvp-checkout-1" });

    await expect(
      submitRsvp(
        buildFormData({
          attending: "no",
          adultAttendeeCount: "0",
          childAttendeeCount: "0",
          familyNames: undefined,
          dietaryNotes: undefined,
          notes: undefined,
        }),
      ),
    ).resolves.toEqual({
      ok: false,
      reason: "duplicate",
      error:
        "This email already has a pending RSVP checkout. Resume checkout or contact the chair before sending another RSVP.",
    });

    expect(participantFindUnique).not.toHaveBeenCalled();
    expect(rsvpCreate).not.toHaveBeenCalled();
  });

  it("creates a fresh RSVP without calling update when no participant exists", async () => {
    registrationFindFirst.mockResolvedValue(null);
    rsvpFindUnique.mockResolvedValue(null);
    participantFindUnique.mockResolvedValue(null);
    rsvpCreate.mockResolvedValue({ id: "rsvp-form-1" });

    await expect(
      submitRsvp(
        buildFormData({
          attending: "no",
          adultAttendeeCount: "0",
          childAttendeeCount: "0",
          familyNames: undefined,
          dietaryNotes: undefined,
          notes: undefined,
        }),
      ),
    ).resolves.toEqual({
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
