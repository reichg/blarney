import { submitRegistration } from "@/app/actions/registration";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  createRegistrationPaymentLink,
  getRegistrationPaymentLinkState,
  hasSquarePaymentConfiguration,
  registrationCheckoutUpdate,
  registrationCheckoutFindFirst,
  registrationCheckoutUpsert,
  registrationCheckoutFindUnique,
  registrationCheckoutCreate,
  registrationFindFirst,
  dbTransaction,
  participantUpsert,
  registrationUpsert,
  rsvpCreate,
  rsvpFindUnique,
} = vi.hoisted(() => ({
  createRegistrationPaymentLink: vi.fn(),
  getRegistrationPaymentLinkState: vi.fn(),
  hasSquarePaymentConfiguration: vi.fn(),
  registrationCheckoutUpdate: vi.fn(),
  registrationCheckoutFindFirst: vi.fn(),
  registrationCheckoutUpsert: vi.fn(),
  registrationCheckoutFindUnique: vi.fn(),
  registrationCheckoutCreate: vi.fn(),
  registrationFindFirst: vi.fn(),
  dbTransaction: vi.fn(),
  participantUpsert: vi.fn(),
  registrationUpsert: vi.fn(),
  rsvpCreate: vi.fn(),
  rsvpFindUnique: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: dbTransaction,
    registrationCheckout: {
      findFirst: registrationCheckoutFindFirst,
      findUnique: registrationCheckoutFindUnique,
      create: registrationCheckoutCreate,
      upsert: registrationCheckoutUpsert,
      update: registrationCheckoutUpdate,
    },
    participant: {
      upsert: participantUpsert,
    },
    registration: {
      findFirst: registrationFindFirst,
      upsert: registrationUpsert,
    },
    rsvp: {
      create: rsvpCreate,
      findUnique: rsvpFindUnique,
    },
  },
}));

vi.mock("@/lib/payment", () => ({
  completeRegistrationPaymentStatuses: ["CONFIRMED", "WAIVED"],
  createRegistrationPaymentLink,
  getRegistrationPaymentLinkState,
  hasSquarePaymentConfiguration,
}));

function buildPayload() {
  return {
    firstName: "Pat",
    lastName: "Golfer",
    email: "pat@example.com",
    phone: "555-0100",
    gender: "FEMALE",
    age: 42,
    averageScore: 39,
    packageSelection: "GOLF",
    adultGuestCount: 2,
    childGuestCount: 1,
    dayBeforeRsvp: false,
    notes: "Registration note",
  };
}

function buildCheckout(overrides = {}) {
  return {
    id: "checkout-1",
    idempotencyKey: "checkout-key",
    email: "pat@example.com",
    payload: buildPayload(),
    paymentReference: null,
    paymentOrderId: "order-123",
    paymentUrl: null,
    status: "PENDING",
    registrationId: null,
    confirmedAt: null,
    paymentCompletedAt: null,
    paymentReviewReason: null,
    lastReconciledAt: null,
    ...overrides,
  };
}

function buildFormData(overrides?: Record<string, string | undefined>) {
  const formData = new FormData();
  const entries = {
    firstName: "Pat",
    lastName: "Golfer",
    email: "Pat@example.com",
    phone: "555-0100",
    gender: "FEMALE",
    age: "42",
    averageScore: "39",
    packageSelection: "GOLF",
    adultGuestCount: "2",
    childGuestCount: "1",
    dayBeforeRsvp: "no",
    notes: "Registration note",
    ...overrides,
  };

  for (const [key, value] of Object.entries(entries)) {
    if (value !== undefined) {
      formData.set(key, value);
    }
  }

  return formData;
}

beforeEach(() => {
  registrationFindFirst.mockResolvedValue(null);
  rsvpFindUnique.mockResolvedValue(null);
  registrationCheckoutFindFirst.mockResolvedValue(null);
  registrationCheckoutUpdate.mockResolvedValue({ registrationId: null });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("submitRegistration", () => {
  it("creates a checkout and payment link without creating Registration or RSVP rows", async () => {
    registrationCheckoutFindUnique.mockResolvedValue(null);
    registrationCheckoutCreate.mockResolvedValue(buildCheckout());
    hasSquarePaymentConfiguration.mockReturnValue(true);
    createRegistrationPaymentLink.mockResolvedValue({
      reference: "payment-link-1",
      url: "https://square.link/u/checkout-1",
    });

    const formData = buildFormData();
    formData.set("dayBeforeRsvp", "yes");

    await expect(submitRegistration(formData)).resolves.toEqual({
      ok: true,
      checkoutId: "checkout-1",
      checkoutUrl: "https://square.link/u/checkout-1",
      paymentUrl: "https://square.link/u/checkout-1",
      paymentPath: "/register/payment?checkout=checkout-1",
      thanksPath: "/register/thanks?checkout=checkout-1",
    });

    expect(registrationCheckoutCreate).toHaveBeenCalledWith({
      data: {
        idempotencyKey: expect.any(String),
        email: "pat@example.com",
        payload: expect.objectContaining({
          email: "pat@example.com",
          dayBeforeRsvp: true,
          adultGuestCount: 2,
          childGuestCount: 1,
        }),
      },
    });
    expect(createRegistrationPaymentLink).toHaveBeenCalledWith({
      checkoutId: "checkout-1",
      email: "pat@example.com",
      adultGuestCount: 2,
      childGuestCount: 1,
    });
    expect(registrationCheckoutUpdate).toHaveBeenCalledWith({
      where: { id: "checkout-1" },
      data: {
        paymentReference: "payment-link-1",
        paymentUrl: "https://square.link/u/checkout-1",
      },
    });
    expect(dbTransaction).not.toHaveBeenCalled();
    expect(participantUpsert).not.toHaveBeenCalled();
    expect(registrationUpsert).not.toHaveBeenCalled();
    expect(rsvpCreate).not.toHaveBeenCalled();
  });

  it("reuses the existing pending checkout payment URL for identical submissions", async () => {
    registrationCheckoutFindFirst.mockResolvedValue(
      buildCheckout({
        paymentReference: "payment-link-1",
        paymentOrderId: "order-123",
        paymentUrl: "https://square.link/u/existing",
      }),
    );
    hasSquarePaymentConfiguration.mockReturnValue(true);
    getRegistrationPaymentLinkState.mockResolvedValue({
      reference: "payment-link-1",
      orderId: "order-123",
      url: "https://square.link/u/existing",
      orderState: "OPEN",
      isComplete: false,
    });

    await expect(submitRegistration(buildFormData())).resolves.toMatchObject({
      ok: true,
      checkoutId: "checkout-1",
      paymentUrl: "https://square.link/u/existing",
      paymentPath: "/register/payment?checkout=checkout-1",
    });

    expect(createRegistrationPaymentLink).not.toHaveBeenCalled();
    expect(registrationCheckoutUpdate).toHaveBeenCalledWith({
      where: { id: "checkout-1" },
      data: {
        paymentOrderId: "order-123",
        lastReconciledAt: expect.any(Date),
      },
    });
    expect(dbTransaction).not.toHaveBeenCalled();
    expect(registrationCheckoutCreate).not.toHaveBeenCalled();
  });

  it("rejects an email that already has a registration", async () => {
    registrationFindFirst.mockResolvedValue({ id: "registration-previous" });

    await expect(submitRegistration(buildFormData())).resolves.toEqual({
      ok: false,
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
    expect(registrationCheckoutFindUnique).not.toHaveBeenCalled();
    expect(registrationCheckoutCreate).not.toHaveBeenCalled();
    expect(createRegistrationPaymentLink).not.toHaveBeenCalled();
    expect(dbTransaction).not.toHaveBeenCalled();
    expect(participantUpsert).not.toHaveBeenCalled();
    expect(registrationUpsert).not.toHaveBeenCalled();
    expect(rsvpCreate).not.toHaveBeenCalled();
  });

  it("rejects an email that already has an RSVP", async () => {
    rsvpFindUnique.mockResolvedValue({ id: "rsvp-previous" });

    await expect(submitRegistration(buildFormData())).resolves.toEqual({
      ok: false,
      error: "This email already has a registration or RSVP on file.",
    });

    expect(registrationFindFirst).toHaveBeenCalled();
    expect(rsvpFindUnique).toHaveBeenCalledWith({
      where: { email: "pat@example.com" },
      select: { id: true },
    });
    expect(registrationCheckoutFindUnique).not.toHaveBeenCalled();
    expect(registrationCheckoutCreate).not.toHaveBeenCalled();
    expect(createRegistrationPaymentLink).not.toHaveBeenCalled();
    expect(dbTransaction).not.toHaveBeenCalled();
    expect(participantUpsert).not.toHaveBeenCalled();
    expect(registrationUpsert).not.toHaveBeenCalled();
    expect(rsvpCreate).not.toHaveBeenCalled();
  });

  it("returns a validation error before creating a checkout for invalid input", async () => {
    await expect(
      submitRegistration(buildFormData({ email: "not-an-email" })),
    ).resolves.toEqual({
      ok: false,
      error: "Complete the required registration details and try again.",
    });

    expect(registrationCheckoutCreate).not.toHaveBeenCalled();
    expect(registrationCheckoutFindUnique).not.toHaveBeenCalled();
    expect(createRegistrationPaymentLink).not.toHaveBeenCalled();
  });

  it.each([
    { description: "phone is blank", overrides: { phone: "" } },
    {
      description: "adult guest count is missing",
      overrides: { adultGuestCount: undefined },
    },
    {
      description: "child guest count is missing",
      overrides: { childGuestCount: undefined },
    },
    {
      description: "day-before RSVP choice is missing",
      overrides: { dayBeforeRsvp: undefined },
    },
    { description: "notes are blank", overrides: { notes: "" } },
  ])("returns a validation error when $description", async ({ overrides }) => {
    await expect(submitRegistration(buildFormData(overrides))).resolves.toEqual(
      {
        ok: false,
        error: "Complete the required registration details and try again.",
      },
    );

    expect(registrationCheckoutCreate).not.toHaveBeenCalled();
    expect(registrationCheckoutFindUnique).not.toHaveBeenCalled();
    expect(createRegistrationPaymentLink).not.toHaveBeenCalled();
  });
});
