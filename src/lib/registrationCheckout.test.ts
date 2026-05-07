import {
  confirmRegistrationCheckoutPayment,
  confirmRegistrationCheckoutPaymentByOrderId,
  createRegistrationCheckoutPayment,
  getRegistrationCheckoutIdempotencyKey,
  type RegistrationCheckoutPayload,
} from "@/lib/registrationCheckout";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  createRegistrationPaymentLink,
  getRegistrationPaymentLinkState,
  hasSquarePaymentConfiguration,
  dbTransaction,
  checkoutFindFirst,
  checkoutFindUnique,
  checkoutUpdate,
  checkoutCreate,
  registrationFindFirst,
  rsvpCheckoutFindFirst,
  rsvpFindUnique,
  txCheckoutFindFirst,
  txCheckoutFindUnique,
  txCheckoutUpdate,
  txRegistrationFindFirst,
  participantCreate,
  registrationCreate,
  rsvpCreate,
} = vi.hoisted(() => ({
  createRegistrationPaymentLink: vi.fn(),
  getRegistrationPaymentLinkState: vi.fn(),
  hasSquarePaymentConfiguration: vi.fn(),
  dbTransaction: vi.fn(),
  checkoutFindFirst: vi.fn(),
  checkoutFindUnique: vi.fn(),
  checkoutUpdate: vi.fn(),
  checkoutCreate: vi.fn(),
  registrationFindFirst: vi.fn(),
  rsvpCheckoutFindFirst: vi.fn(),
  rsvpFindUnique: vi.fn(),
  txCheckoutFindFirst: vi.fn(),
  txCheckoutFindUnique: vi.fn(),
  txCheckoutUpdate: vi.fn(),
  txRegistrationFindFirst: vi.fn(),
  participantCreate: vi.fn(),
  registrationCreate: vi.fn(),
  rsvpCreate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: dbTransaction,
    registrationCheckout: {
      findFirst: checkoutFindFirst,
      findUnique: checkoutFindUnique,
      update: checkoutUpdate,
      create: checkoutCreate,
    },
    registration: {
      findFirst: registrationFindFirst,
    },
    rsvp: {
      findUnique: rsvpFindUnique,
    },
    rsvpCheckout: {
      findFirst: rsvpCheckoutFindFirst,
    },
  },
}));

vi.mock("@/lib/payment", () => ({
  createRegistrationPaymentLink,
  getRegistrationPaymentLinkState,
  hasSquarePaymentConfiguration,
}));

const payload: RegistrationCheckoutPayload = {
  firstName: "Morgan",
  lastName: "Payer",
  email: "morgan@example.com",
  phone: "555-0100",
  packageSelection: "GOLF",
  golfers: [
    {
      firstName: "Pat",
      lastName: "Golfer",
      gender: "FEMALE",
      age: 42,
      averageScore: 39,
    },
    {
      firstName: "Riley",
      lastName: "Golfer",
      gender: "MALE",
      age: 14,
      averageScore: 48,
    },
  ],
  bbqOnlyAdultCount: 2,
  bbqOnlyKidCount: 1,
  notes: "Seat us with the early group",
  dietaryNotes: "Vegetarian dinner",
};

function buildCheckout(overrides = {}) {
  return {
    id: "checkout-123",
    idempotencyKey: "checkout-key",
    email: payload.email,
    payload,
    paymentReference: "payment-link-1",
    paymentOrderId: "order-123",
    paymentUrl: "https://square.link/u/existing",
    status: "PENDING",
    registrationId: null,
    confirmedAt: null,
    paymentCompletedAt: null,
    paymentReviewReason: null,
    lastReconciledAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  dbTransaction.mockImplementation((callback) =>
    callback({
      registrationCheckout: {
        findFirst: txCheckoutFindFirst,
        findUnique: txCheckoutFindUnique,
        update: txCheckoutUpdate,
      },
      participant: {
        create: participantCreate,
      },
      registration: {
        findFirst: txRegistrationFindFirst,
        create: registrationCreate,
      },
      rsvp: {
        create: rsvpCreate,
        findUnique: rsvpFindUnique,
      },
    }),
  );
  checkoutFindFirst.mockResolvedValue(null);
  checkoutFindUnique.mockResolvedValue(null);
  checkoutUpdate.mockResolvedValue({ registrationId: null });
  registrationFindFirst.mockResolvedValue(null);
  rsvpCheckoutFindFirst.mockResolvedValue(null);
  rsvpFindUnique.mockResolvedValue(null);
  txCheckoutFindFirst.mockResolvedValue(null);
  txRegistrationFindFirst.mockResolvedValue(null);
  txCheckoutUpdate.mockResolvedValue({});
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("registration checkout payments", () => {
  it("creates only a checkout row before payment succeeds", async () => {
    checkoutCreate.mockResolvedValue(
      buildCheckout({ paymentReference: null, paymentUrl: null }),
    );
    hasSquarePaymentConfiguration.mockReturnValue(true);
    createRegistrationPaymentLink.mockResolvedValue({
      reference: "payment-link-1",
      orderId: "order-123",
      url: "https://square.link/u/new",
    });

    await expect(createRegistrationCheckoutPayment(payload)).resolves.toEqual({
      ok: true,
      status: "pending",
      checkoutId: "checkout-123",
      paymentReference: "payment-link-1",
      paymentUrl: "https://square.link/u/new",
    });

    expect(checkoutCreate).toHaveBeenCalledWith({
      data: {
        idempotencyKey: expect.any(String),
        email: "morgan@example.com",
        payload,
      },
    });
    expect(createRegistrationPaymentLink).toHaveBeenCalledWith({
      checkoutId: "checkout-123",
      email: "morgan@example.com",
      golferCount: 2,
      bbqOnlyAdultCount: 2,
      bbqOnlyKidCount: 1,
    });
    expect(dbTransaction).not.toHaveBeenCalled();
    expect(participantCreate).not.toHaveBeenCalled();
    expect(registrationCreate).not.toHaveBeenCalled();
    expect(rsvpCreate).not.toHaveBeenCalled();
  });

  it("uses a stable checkout idempotency key for identical payloads", () => {
    expect(getRegistrationCheckoutIdempotencyKey(payload)).toBe(
      getRegistrationCheckoutIdempotencyKey({ ...payload }),
    );
  });

  it("rejects checkout creation when the payer email has a confirmed checkout", async () => {
    checkoutFindFirst.mockResolvedValueOnce({ id: "confirmed-checkout" });

    await expect(createRegistrationCheckoutPayment(payload)).resolves.toEqual({
      ok: false,
      reason: "duplicate",
    });

    expect(checkoutFindFirst).toHaveBeenCalledWith({
      where: {
        email: "morgan@example.com",
        status: "CONFIRMED",
      },
      select: { id: true },
    });
    expect(checkoutCreate).not.toHaveBeenCalled();
    expect(createRegistrationPaymentLink).not.toHaveBeenCalled();
  });

  it("reuses an active pending checkout for the same payer email", async () => {
    checkoutFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(buildCheckout());
    hasSquarePaymentConfiguration.mockReturnValue(true);
    getRegistrationPaymentLinkState.mockResolvedValue({
      reference: "payment-link-1",
      orderId: "order-123",
      url: "https://square.link/u/existing",
      orderState: "OPEN",
      isComplete: false,
    });

    await expect(createRegistrationCheckoutPayment(payload)).resolves.toEqual({
      ok: true,
      status: "pending",
      checkoutId: "checkout-123",
      paymentReference: "payment-link-1",
      paymentUrl: "https://square.link/u/existing",
    });

    expect(checkoutCreate).not.toHaveBeenCalled();
    expect(createRegistrationPaymentLink).not.toHaveBeenCalled();
  });

  it("finalizes multiple golfers, registrations, and one payer BBQ RSVP after Square success", async () => {
    checkoutFindUnique.mockResolvedValue(buildCheckout());
    getRegistrationPaymentLinkState.mockResolvedValue({
      reference: "payment-link-1",
      orderId: "order-123",
      url: "https://square.link/u/existing",
      orderState: "COMPLETED",
      isComplete: true,
    });
    hasSquarePaymentConfiguration.mockReturnValue(true);
    txCheckoutFindUnique.mockResolvedValue(buildCheckout());
    participantCreate
      .mockResolvedValueOnce({ id: "participant-1" })
      .mockResolvedValueOnce({ id: "participant-2" });
    registrationCreate
      .mockResolvedValueOnce({ id: "registration-1" })
      .mockResolvedValueOnce({ id: "registration-2" });

    await expect(
      confirmRegistrationCheckoutPayment("checkout-123"),
    ).resolves.toEqual({
      ok: true,
      registrationId: "registration-1",
    });

    expect(participantCreate).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        firstName: "Pat",
        email: null,
        phone: "555-0100",
        age: 42,
      }),
    });
    expect(participantCreate).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({
        firstName: "Riley",
        email: null,
        phone: "555-0100",
        age: 14,
      }),
    });
    expect(registrationCreate).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        participantId: "participant-1",
        checkoutId: "checkout-123",
        adultGuestCount: 2,
        childGuestCount: 1,
        paymentStatus: "CONFIRMED",
        paymentReference: "payment-link-1",
      }),
    });
    expect(registrationCreate).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({
        participantId: "participant-2",
        checkoutId: "checkout-123",
        adultGuestCount: 0,
        childGuestCount: 0,
        paymentStatus: "CONFIRMED",
        paymentReference: "payment-link-1",
      }),
    });
    expect(rsvpCreate).toHaveBeenCalledWith({
      data: {
        participantId: "participant-1",
        source: "REGISTRATION",
        firstName: "Morgan",
        lastName: "Payer",
        email: "morgan@example.com",
        adultAttendeeCount: 3,
        childAttendeeCount: 2,
        attendeeCount: 5,
        familyNames: "Pat Golfer, Riley Golfer",
        dietaryNotes: "Vegetarian dinner",
        notes: "Seat us with the early group",
      },
    });
    expect(txCheckoutUpdate).toHaveBeenCalledWith({
      where: { id: "checkout-123" },
      data: {
        status: "CONFIRMED",
        confirmedAt: expect.any(Date),
        paymentCompletedAt: expect.any(Date),
        paymentReviewReason: null,
        registrationId: "registration-1",
      },
    });
  });

  it("does not create duplicates when confirmation is repeated", async () => {
    checkoutFindUnique.mockResolvedValue(
      buildCheckout({ status: "CONFIRMED", registrationId: "registration-1" }),
    );

    await expect(
      confirmRegistrationCheckoutPayment("checkout-123"),
    ).resolves.toEqual({
      ok: true,
      registrationId: "registration-1",
    });

    expect(getRegistrationPaymentLinkState).not.toHaveBeenCalled();
    expect(dbTransaction).not.toHaveBeenCalled();
    expect(registrationCreate).not.toHaveBeenCalled();
    expect(rsvpCreate).not.toHaveBeenCalled();
  });

  it("marks paid checkout for review instead of finalizing over an existing RSVP", async () => {
    checkoutFindUnique.mockResolvedValue(buildCheckout());
    getRegistrationPaymentLinkState.mockResolvedValue({
      reference: "payment-link-1",
      orderId: "order-123",
      url: "https://square.link/u/existing",
      orderState: "COMPLETED",
      isComplete: true,
    });
    hasSquarePaymentConfiguration.mockReturnValue(true);
    txCheckoutFindUnique.mockResolvedValue(buildCheckout());
    rsvpFindUnique.mockResolvedValue({ id: "rsvp-form-1" });

    await expect(
      confirmRegistrationCheckoutPayment("checkout-123"),
    ).resolves.toEqual({
      ok: false,
      reason: "review",
    });

    expect(participantCreate).not.toHaveBeenCalled();
    expect(registrationCreate).not.toHaveBeenCalled();
    expect(rsvpCreate).not.toHaveBeenCalled();
    expect(checkoutUpdate).toHaveBeenLastCalledWith({
      where: { id: "checkout-123" },
      data: expect.objectContaining({
        status: "PAYMENT_REVIEW",
        paymentReviewReason:
          "Square return reconciliation showed this checkout as paid, but local registration finalization did not complete.",
      }),
      select: { registrationId: true },
    });
  });

  it("finalizes a checkout from a completed Square webhook order id", async () => {
    checkoutFindUnique.mockResolvedValue(buildCheckout());
    txCheckoutFindUnique.mockResolvedValue(buildCheckout());
    participantCreate
      .mockResolvedValueOnce({ id: "participant-1" })
      .mockResolvedValueOnce({ id: "participant-2" });
    registrationCreate
      .mockResolvedValueOnce({ id: "registration-1" })
      .mockResolvedValueOnce({ id: "registration-2" });

    await expect(
      confirmRegistrationCheckoutPaymentByOrderId(" order-123 "),
    ).resolves.toEqual({
      ok: true,
      registrationId: "registration-1",
    });

    expect(checkoutFindUnique).toHaveBeenCalledWith({
      where: { paymentOrderId: "order-123" },
    });
    expect(registrationCreate).toHaveBeenCalled();
    expect(txCheckoutUpdate).toHaveBeenCalledWith({
      where: { id: "checkout-123" },
      data: expect.objectContaining({
        status: "CONFIRMED",
        registrationId: "registration-1",
      }),
    });
  });
});
