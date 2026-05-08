import { submitRsvp } from "@/app/actions/rsvp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  createRsvpCheckoutPayment,
  registrationCheckoutFindFirst,
  registrationFindFirst,
  rsvpFindUnique,
} = vi.hoisted(() => ({
  createRsvpCheckoutPayment: vi.fn(),
  registrationCheckoutFindFirst: vi.fn(),
  registrationFindFirst: vi.fn(),
  rsvpFindUnique: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    registration: {
      findFirst: registrationFindFirst,
    },
    registrationCheckout: {
      findFirst: registrationCheckoutFindFirst,
    },
    rsvp: {
      findUnique: rsvpFindUnique,
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
    phone: "555-0100",
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
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("submitRsvp", () => {
  it("starts a paid RSVP checkout for a fresh email", async () => {
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
  });

  it("allows blank optional BBQ text fields", async () => {
    registrationFindFirst.mockResolvedValue(null);
    rsvpFindUnique.mockResolvedValue(null);
    createRsvpCheckoutPayment.mockResolvedValue({
      ok: true,
      status: "pending",
      checkoutId: "rsvp-checkout-1",
      paymentReference: "payment-link-1",
      paymentUrl: "https://square.link/u/rsvp-checkout-1",
    });

    await expect(
      submitRsvp(
        buildFormData({
          familyNames: undefined,
          dietaryNotes: undefined,
          notes: undefined,
        }),
      ),
    ).resolves.toMatchObject({
      ok: true,
      checkoutId: "rsvp-checkout-1",
    });

    expect(createRsvpCheckoutPayment).toHaveBeenCalledWith({
      firstName: "Pat",
      lastName: "Golfer",
      email: "pat@example.com",
      adultAttendeeCount: 2,
      childAttendeeCount: 1,
      familyNames: null,
      dietaryNotes: null,
      notes: null,
    });
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
  });

  it("returns an unavailable result when Square is temporarily unavailable before BBQ checkout opens", async () => {
    registrationFindFirst.mockResolvedValue(null);
    rsvpFindUnique.mockResolvedValue(null);
    createRsvpCheckoutPayment.mockResolvedValue({
      ok: false,
      reason: "unavailable",
    });

    await expect(submitRsvp(buildFormData())).resolves.toEqual({
      ok: false,
      reason: "unavailable",
      error:
        "We could not reach Square to verify or reopen this checkout right now. Wait a moment and try again. If you already have a Square receipt, do not pay again; contact the chair.",
    });
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
  });

  it.each([
    {
      description: "phone is missing",
      overrides: { phone: undefined },
    },
    {
      description: "adult attendee count is missing",
      overrides: { adultAttendeeCount: undefined },
    },
    {
      description: "child attendee count is missing",
      overrides: { childAttendeeCount: undefined },
    },
  ])("returns an invalid result when $description", async ({ overrides }) => {
    await expect(submitRsvp(buildFormData(overrides))).resolves.toEqual({
      ok: false,
      reason: "invalid",
      error: "Complete the required RSVP details and try again.",
    });

    expect(registrationFindFirst).not.toHaveBeenCalled();
    expect(rsvpFindUnique).not.toHaveBeenCalled();
    expect(registrationCheckoutFindFirst).not.toHaveBeenCalled();
  });

  it("returns an invalid result when the attendee count is zero", async () => {
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

    expect(createRsvpCheckoutPayment).toHaveBeenCalledTimes(1);
  });
});
