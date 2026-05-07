import {
  confirmRsvpCheckoutPayment,
  confirmRsvpCheckoutPaymentByOrderId,
  createRsvpCheckoutPayment,
  getRsvpCheckoutIdempotencyKey,
  type RsvpCheckoutPayload,
} from "@/lib/rsvpCheckout";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  createRsvpPaymentLink,
  getRegistrationPaymentLinkState,
  hasSquarePaymentConfiguration,
  dbTransaction,
  checkoutFindFirst,
  checkoutFindUnique,
  checkoutUpdate,
  checkoutCreate,
  registrationFindFirst,
  registrationCheckoutFindFirst,
  txCheckoutFindUnique,
  txCheckoutUpdate,
  participantFindUnique,
  rsvpCreate,
  rsvpFindUnique,
} = vi.hoisted(() => ({
  createRsvpPaymentLink: vi.fn(),
  getRegistrationPaymentLinkState: vi.fn(),
  hasSquarePaymentConfiguration: vi.fn(),
  dbTransaction: vi.fn(),
  checkoutFindFirst: vi.fn(),
  checkoutFindUnique: vi.fn(),
  checkoutUpdate: vi.fn(),
  checkoutCreate: vi.fn(),
  registrationFindFirst: vi.fn(),
  registrationCheckoutFindFirst: vi.fn(),
  txCheckoutFindUnique: vi.fn(),
  txCheckoutUpdate: vi.fn(),
  participantFindUnique: vi.fn(),
  rsvpCreate: vi.fn(),
  rsvpFindUnique: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: dbTransaction,
    rsvpCheckout: {
      findFirst: checkoutFindFirst,
      findUnique: checkoutFindUnique,
      update: checkoutUpdate,
      create: checkoutCreate,
    },
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
  createRsvpPaymentLink,
  getRegistrationPaymentLinkState,
  hasSquarePaymentConfiguration,
}));

const payload: RsvpCheckoutPayload = {
  firstName: "Pat",
  lastName: "Family",
  email: "pat@example.com",
  adultAttendeeCount: 2,
  childAttendeeCount: 1,
  familyNames: "Pat, Sam, and Riley",
  dietaryNotes: "Vegetarian dinner",
  notes: "Seat us with the early group",
};

function buildCheckout(overrides = {}) {
  return {
    id: "rsvp-checkout-123",
    idempotencyKey: "rsvp-checkout-key",
    email: payload.email,
    payload,
    paymentReference: "payment-link-1",
    paymentOrderId: "order-123",
    paymentUrl: "https://square.link/u/existing",
    status: "PENDING",
    rsvpId: null,
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
      rsvpCheckout: {
        findUnique: txCheckoutFindUnique,
        update: txCheckoutUpdate,
      },
      participant: {
        findUnique: participantFindUnique,
      },
      registration: {
        findFirst: registrationFindFirst,
      },
      registrationCheckout: {
        findFirst: registrationCheckoutFindFirst,
      },
      rsvp: {
        create: rsvpCreate,
        findUnique: rsvpFindUnique,
      },
    }),
  );
  registrationFindFirst.mockResolvedValue(null);
  registrationCheckoutFindFirst.mockResolvedValue(null);
  rsvpFindUnique.mockResolvedValue(null);
  checkoutFindFirst.mockResolvedValue(null);
  checkoutUpdate.mockResolvedValue({ rsvpId: null });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("RSVP checkout payments", () => {
  it("creates only a checkout row before payment succeeds", async () => {
    checkoutCreate.mockResolvedValue(
      buildCheckout({ paymentReference: null, paymentUrl: null }),
    );
    hasSquarePaymentConfiguration.mockReturnValue(true);
    createRsvpPaymentLink.mockResolvedValue({
      reference: "payment-link-1",
      orderId: "order-123",
      url: "https://square.link/u/new",
    });

    await expect(createRsvpCheckoutPayment(payload)).resolves.toEqual({
      ok: true,
      status: "pending",
      checkoutId: "rsvp-checkout-123",
      paymentReference: "payment-link-1",
      paymentUrl: "https://square.link/u/new",
    });

    expect(checkoutCreate).toHaveBeenCalledWith({
      data: {
        idempotencyKey: expect.any(String),
        email: "pat@example.com",
        payload,
      },
    });
    expect(createRsvpPaymentLink).toHaveBeenCalledWith({
      checkoutId: "rsvp-checkout-123",
      email: "pat@example.com",
      adultAttendeeCount: 2,
      childAttendeeCount: 1,
    });
    expect(dbTransaction).not.toHaveBeenCalled();
    expect(rsvpCreate).not.toHaveBeenCalled();
  });

  it("uses a stable checkout idempotency key for identical payloads", () => {
    expect(getRsvpCheckoutIdempotencyKey(payload)).toBe(
      getRsvpCheckoutIdempotencyKey({ ...payload }),
    );
  });

  it("rejects checkout creation when the email already has a registration", async () => {
    registrationFindFirst.mockResolvedValue({ id: "registration-1" });

    await expect(createRsvpCheckoutPayment(payload)).resolves.toEqual({
      ok: false,
      reason: "duplicate",
    });

    expect(checkoutCreate).not.toHaveBeenCalled();
    expect(createRsvpPaymentLink).not.toHaveBeenCalled();
  });

  it("rejects checkout creation when the email has an active golf checkout", async () => {
    registrationCheckoutFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "checkout-1" });

    await expect(createRsvpCheckoutPayment(payload)).resolves.toEqual({
      ok: false,
      reason: "duplicate",
    });

    expect(registrationCheckoutFindFirst).toHaveBeenCalledWith({
      where: {
        email: "pat@example.com",
        status: { in: ["PENDING", "PAYMENT_REVIEW"] },
      },
      select: { id: true },
    });
    expect(checkoutCreate).not.toHaveBeenCalled();
    expect(createRsvpPaymentLink).not.toHaveBeenCalled();
  });

  it("finalizes a FORM RSVP after Square success", async () => {
    checkoutFindUnique.mockResolvedValue(buildCheckout());
    getRegistrationPaymentLinkState.mockResolvedValue({
      reference: "payment-link-1",
      url: "https://square.link/u/existing",
      orderState: "COMPLETED",
      isComplete: true,
    });
    hasSquarePaymentConfiguration.mockReturnValue(true);
    txCheckoutFindUnique.mockResolvedValue(buildCheckout());
    participantFindUnique.mockResolvedValue({ id: "participant-1" });
    rsvpCreate.mockResolvedValue({ id: "rsvp-form-1" });
    txCheckoutUpdate.mockResolvedValue({});

    await expect(
      confirmRsvpCheckoutPayment("rsvp-checkout-123"),
    ).resolves.toEqual({
      ok: true,
      rsvpId: "rsvp-form-1",
    });

    expect(registrationFindFirst).toHaveBeenCalledWith({
      where: {
        participant: {
          email: "pat@example.com",
        },
      },
      select: { id: true },
    });
    expect(rsvpCreate).toHaveBeenCalledWith({
      data: {
        participantId: "participant-1",
        source: "FORM",
        firstName: "Pat",
        lastName: "Family",
        email: "pat@example.com",
        adultAttendeeCount: 2,
        childAttendeeCount: 1,
        attendeeCount: 3,
        familyNames: "Pat, Sam, and Riley",
        dietaryNotes: "Vegetarian dinner",
        notes: "Seat us with the early group",
      },
    });
    expect(txCheckoutUpdate).toHaveBeenCalledWith({
      where: { id: "rsvp-checkout-123" },
      data: {
        status: "CONFIRMED",
        confirmedAt: expect.any(Date),
        paymentCompletedAt: expect.any(Date),
        paymentReviewReason: null,
        rsvpId: "rsvp-form-1",
      },
    });
  });

  it("does not finalize while Square still reports the checkout as pending", async () => {
    checkoutFindUnique.mockResolvedValue(buildCheckout());
    hasSquarePaymentConfiguration.mockReturnValue(true);
    getRegistrationPaymentLinkState.mockResolvedValue({
      reference: "payment-link-1",
      url: "https://square.link/u/existing",
      orderState: "OPEN",
      isComplete: false,
    });

    await expect(
      confirmRsvpCheckoutPayment("rsvp-checkout-123"),
    ).resolves.toEqual({
      ok: false,
      reason: "pending",
      paymentUrl: "https://square.link/u/existing",
    });

    expect(dbTransaction).not.toHaveBeenCalled();
    expect(rsvpCreate).not.toHaveBeenCalled();
  });

  it("finalizes a checkout from a completed Square webhook order id", async () => {
    checkoutFindUnique.mockResolvedValue(buildCheckout());
    txCheckoutFindUnique.mockResolvedValue(buildCheckout());
    participantFindUnique.mockResolvedValue(null);
    rsvpCreate.mockResolvedValue({ id: "rsvp-form-1" });
    txCheckoutUpdate.mockResolvedValue({});

    await expect(
      confirmRsvpCheckoutPaymentByOrderId(" order-123 "),
    ).resolves.toEqual({
      ok: true,
      rsvpId: "rsvp-form-1",
    });

    expect(checkoutFindUnique).toHaveBeenCalledWith({
      where: { paymentOrderId: "order-123" },
    });
    expect(rsvpCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        participantId: null,
        source: "FORM",
        email: "pat@example.com",
      }),
    });
  });
});
