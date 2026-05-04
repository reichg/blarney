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
  checkoutUpsert,
  checkoutCreate,
  registrationFindFirst,
  txCheckoutFindUnique,
  txCheckoutUpdate,
  participantUpsert,
  registrationUpsert,
  rsvpCreate,
  rsvpFindUnique,
  rsvpUpdate,
} = vi.hoisted(() => ({
  createRegistrationPaymentLink: vi.fn(),
  getRegistrationPaymentLinkState: vi.fn(),
  hasSquarePaymentConfiguration: vi.fn(),
  dbTransaction: vi.fn(),
  checkoutFindFirst: vi.fn(),
  checkoutFindUnique: vi.fn(),
  checkoutUpdate: vi.fn(),
  checkoutUpsert: vi.fn(),
  checkoutCreate: vi.fn(),
  registrationFindFirst: vi.fn(),
  txCheckoutFindUnique: vi.fn(),
  txCheckoutUpdate: vi.fn(),
  participantUpsert: vi.fn(),
  registrationUpsert: vi.fn(),
  rsvpCreate: vi.fn(),
  rsvpFindUnique: vi.fn(),
  rsvpUpdate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: dbTransaction,
    registrationCheckout: {
      findFirst: checkoutFindFirst,
      findUnique: checkoutFindUnique,
      update: checkoutUpdate,
      upsert: checkoutUpsert,
      create: checkoutCreate,
    },
    registration: {
      findFirst: registrationFindFirst,
    },
    rsvp: {
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

const payload: RegistrationCheckoutPayload = {
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
  dayBeforeRsvp: true,
  notes: "Registration note",
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
        findUnique: txCheckoutFindUnique,
        update: txCheckoutUpdate,
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
        update: rsvpUpdate,
      },
    }),
  );
  registrationFindFirst.mockResolvedValue(null);
  rsvpFindUnique.mockResolvedValue(null);
  checkoutFindFirst.mockResolvedValue(null);
  checkoutUpdate.mockResolvedValue({ registrationId: null });
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
        email: "pat@example.com",
        payload,
      },
    });
    expect(checkoutUpdate).toHaveBeenCalledWith({
      where: { id: "checkout-123" },
      data: {
        paymentReference: "payment-link-1",
        paymentOrderId: "order-123",
        paymentUrl: "https://square.link/u/new",
      },
    });
    expect(dbTransaction).not.toHaveBeenCalled();
    expect(participantUpsert).not.toHaveBeenCalled();
    expect(registrationUpsert).not.toHaveBeenCalled();
    expect(rsvpCreate).not.toHaveBeenCalled();
  });

  it("uses a stable checkout idempotency key for identical payloads", () => {
    expect(getRegistrationCheckoutIdempotencyKey(payload)).toBe(
      getRegistrationCheckoutIdempotencyKey({ ...payload }),
    );
  });

  it("reuses an existing pending checkout payment URL", async () => {
    checkoutFindFirst.mockResolvedValue(buildCheckout());
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

    expect(checkoutFindFirst).toHaveBeenCalledWith({
      where: {
        email: "pat@example.com",
        status: { in: ["PENDING", "PAYMENT_REVIEW"] },
      },
      orderBy: { createdAt: "desc" },
    });
    expect(getRegistrationPaymentLinkState).toHaveBeenCalledWith(
      "payment-link-1",
    );
    expect(createRegistrationPaymentLink).not.toHaveBeenCalled();
    expect(checkoutUpdate).toHaveBeenCalledWith({
      where: { id: "checkout-123" },
      data: {
        paymentOrderId: "order-123",
        lastReconciledAt: expect.any(Date),
      },
    });
    expect(checkoutCreate).not.toHaveBeenCalled();
  });

  it("reuses the active pending checkout for changed same-email payloads", async () => {
    const changedPayload = { ...payload, adultGuestCount: 4 };
    checkoutFindFirst.mockResolvedValue(buildCheckout());
    hasSquarePaymentConfiguration.mockReturnValue(true);
    getRegistrationPaymentLinkState.mockResolvedValue({
      reference: "payment-link-1",
      orderId: "order-123",
      url: "https://square.link/u/existing",
      orderState: "OPEN",
      isComplete: false,
    });

    await expect(
      createRegistrationCheckoutPayment(changedPayload),
    ).resolves.toMatchObject({
      ok: true,
      status: "pending",
      checkoutId: "checkout-123",
      paymentUrl: "https://square.link/u/existing",
    });

    expect(checkoutFindUnique).not.toHaveBeenCalled();
    expect(checkoutCreate).not.toHaveBeenCalled();
    expect(createRegistrationPaymentLink).not.toHaveBeenCalled();
  });

  it("rejects checkout creation when the email already has a registration", async () => {
    registrationFindFirst.mockResolvedValue({ id: "registration-1" });

    await expect(createRegistrationCheckoutPayment(payload)).resolves.toEqual({
      ok: false,
      reason: "duplicate",
    });

    expect(registrationFindFirst).toHaveBeenCalledWith({
      where: {
        participant: {
          email: "pat@example.com",
        },
      },
      select: { id: true },
    });
    expect(checkoutFindUnique).not.toHaveBeenCalled();
    expect(checkoutCreate).not.toHaveBeenCalled();
    expect(createRegistrationPaymentLink).not.toHaveBeenCalled();
  });

  it("rejects checkout creation when the email already has an RSVP", async () => {
    rsvpFindUnique.mockResolvedValue({ id: "rsvp-1" });

    await expect(createRegistrationCheckoutPayment(payload)).resolves.toEqual({
      ok: false,
      reason: "duplicate",
    });

    expect(rsvpFindUnique).toHaveBeenCalledWith({
      where: { email: "pat@example.com" },
      select: { id: true },
    });
    expect(checkoutFindUnique).not.toHaveBeenCalled();
    expect(checkoutCreate).not.toHaveBeenCalled();
    expect(createRegistrationPaymentLink).not.toHaveBeenCalled();
  });

  it("backfills the Square order id before reusing older payment links", async () => {
    checkoutFindUnique.mockResolvedValue(
      buildCheckout({ paymentOrderId: null }),
    );
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

    expect(getRegistrationPaymentLinkState).toHaveBeenCalledWith(
      "payment-link-1",
    );
    expect(checkoutUpdate).toHaveBeenCalledWith({
      where: { id: "checkout-123" },
      data: {
        paymentOrderId: "order-123",
        lastReconciledAt: expect.any(Date),
      },
    });
    expect(createRegistrationPaymentLink).not.toHaveBeenCalled();
    expect(checkoutCreate).not.toHaveBeenCalled();
  });

  it("finalizes Participant, Registration, and registration-sourced RSVP after Square success", async () => {
    checkoutFindUnique.mockResolvedValue(buildCheckout());
    getRegistrationPaymentLinkState.mockResolvedValue({
      reference: "payment-link-1",
      url: "https://square.link/u/existing",
      orderState: "COMPLETED",
      isComplete: true,
    });
    hasSquarePaymentConfiguration.mockReturnValue(true);
    txCheckoutFindUnique.mockResolvedValue(buildCheckout());
    participantUpsert.mockResolvedValue({ id: "participant-1" });
    registrationUpsert.mockResolvedValue({ id: "registration-1" });
    rsvpFindUnique.mockResolvedValue(null);
    txCheckoutUpdate.mockResolvedValue({});

    await expect(
      confirmRegistrationCheckoutPayment("checkout-123"),
    ).resolves.toEqual({
      ok: true,
      registrationId: "registration-1",
    });

    expect(participantUpsert).toHaveBeenCalledWith({
      where: { email: "pat@example.com" },
      update: expect.objectContaining({
        firstName: "Pat",
        averageScore: 39,
      }),
      create: expect.objectContaining({
        email: "pat@example.com",
        firstName: "Pat",
      }),
    });
    expect(registrationUpsert).toHaveBeenCalledWith({
      where: { paymentReference: "payment-link-1" },
      update: { paymentStatus: "CONFIRMED" },
      create: expect.objectContaining({
        participantId: "participant-1",
        adultGuestCount: 2,
        childGuestCount: 1,
        dayBeforeRsvp: true,
        paymentStatus: "CONFIRMED",
        paymentReference: "payment-link-1",
      }),
    });
    expect(rsvpFindUnique).toHaveBeenCalledWith({
      where: { email: "pat@example.com" },
      select: { id: true, participantId: true },
    });
    expect(rsvpCreate).toHaveBeenCalledWith({
      data: {
        participantId: "participant-1",
        source: "REGISTRATION",
        firstName: "Pat",
        lastName: "Golfer",
        email: "pat@example.com",
        attending: true,
        adultAttendeeCount: 3,
        childAttendeeCount: 1,
        attendeeCount: 4,
      },
    });
    expect(rsvpUpdate).not.toHaveBeenCalled();
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

  it("finalizes instead of returning a payment URL when a reused checkout is already paid", async () => {
    checkoutFindFirst.mockResolvedValue(buildCheckout());
    hasSquarePaymentConfiguration.mockReturnValue(true);
    getRegistrationPaymentLinkState.mockResolvedValue({
      reference: "payment-link-1",
      orderId: "order-123",
      url: "https://square.link/u/existing",
      orderState: "COMPLETED",
      isComplete: true,
    });
    txCheckoutFindUnique.mockResolvedValue(buildCheckout());
    participantUpsert.mockResolvedValue({ id: "participant-1" });
    registrationUpsert.mockResolvedValue({ id: "registration-1" });
    rsvpFindUnique.mockResolvedValue(null);
    txCheckoutUpdate.mockResolvedValue({});

    await expect(createRegistrationCheckoutPayment(payload)).resolves.toEqual({
      ok: true,
      status: "confirmed",
      checkoutId: "checkout-123",
      registrationId: "registration-1",
      paymentUrl: null,
    });

    expect(createRegistrationPaymentLink).not.toHaveBeenCalled();
    expect(registrationUpsert).toHaveBeenCalled();
    expect(txCheckoutUpdate).toHaveBeenCalledWith({
      where: { id: "checkout-123" },
      data: expect.objectContaining({
        status: "CONFIRMED",
        registrationId: "registration-1",
      }),
    });
  });

  it("does not create duplicates when confirmation is repeated", async () => {
    checkoutFindUnique.mockResolvedValue(
      buildCheckout({
        status: "CONFIRMED",
        registrationId: "registration-1",
      }),
    );

    await expect(
      confirmRegistrationCheckoutPayment("checkout-123"),
    ).resolves.toEqual({
      ok: true,
      registrationId: "registration-1",
    });

    expect(getRegistrationPaymentLinkState).not.toHaveBeenCalled();
    expect(dbTransaction).not.toHaveBeenCalled();
    expect(registrationUpsert).not.toHaveBeenCalled();
    expect(rsvpCreate).not.toHaveBeenCalled();
  });

  it("does not finalize over an existing registration for the same email", async () => {
    checkoutFindUnique.mockResolvedValue(buildCheckout());
    getRegistrationPaymentLinkState.mockResolvedValue({
      reference: "payment-link-1",
      url: "https://square.link/u/existing",
      orderState: "COMPLETED",
      isComplete: true,
    });
    hasSquarePaymentConfiguration.mockReturnValue(true);
    txCheckoutFindUnique.mockResolvedValue(buildCheckout());
    registrationFindFirst.mockResolvedValue({ id: "registration-existing" });

    await expect(
      confirmRegistrationCheckoutPayment("checkout-123"),
    ).resolves.toEqual({
      ok: false,
      reason: "review",
    });

    expect(registrationFindFirst).toHaveBeenCalledWith({
      where: {
        participant: {
          email: "pat@example.com",
        },
        NOT: {
          paymentReference: "payment-link-1",
        },
      },
      select: { id: true },
    });
    expect(participantUpsert).not.toHaveBeenCalled();
    expect(registrationUpsert).not.toHaveBeenCalled();
    expect(rsvpCreate).not.toHaveBeenCalled();
    expect(rsvpUpdate).not.toHaveBeenCalled();
    expect(txCheckoutUpdate).not.toHaveBeenCalled();
    expect(checkoutUpdate).toHaveBeenLastCalledWith({
      where: { id: "checkout-123" },
      data: {
        status: "PAYMENT_REVIEW",
        paymentReviewReason:
          "Square return reconciliation showed this checkout as paid, but local registration finalization did not complete.",
        paymentCompletedAt: expect.any(Date),
        lastReconciledAt: expect.any(Date),
      },
      select: { registrationId: true },
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
      confirmRegistrationCheckoutPayment("checkout-123"),
    ).resolves.toEqual({
      ok: false,
      reason: "pending",
      paymentUrl: "https://square.link/u/existing",
    });

    expect(dbTransaction).not.toHaveBeenCalled();
    expect(participantUpsert).not.toHaveBeenCalled();
    expect(registrationUpsert).not.toHaveBeenCalled();
    expect(rsvpCreate).not.toHaveBeenCalled();
  });

  it("keeps the checkout processing when Square lookup fails during redirect confirmation", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    checkoutFindUnique.mockResolvedValue(buildCheckout());
    hasSquarePaymentConfiguration.mockReturnValue(true);
    getRegistrationPaymentLinkState.mockRejectedValue(
      new Error("Square lookup failed"),
    );

    await expect(
      confirmRegistrationCheckoutPayment("checkout-123"),
    ).resolves.toEqual({
      ok: false,
      reason: "pending",
      paymentUrl: "https://square.link/u/existing",
    });

    expect(consoleError).toHaveBeenCalledWith(
      "Registration checkout payment lookup failed",
      expect.objectContaining({
        checkoutId: "checkout-123",
        error: expect.any(Error),
      }),
    );
    expect(dbTransaction).not.toHaveBeenCalled();
    expect(registrationUpsert).not.toHaveBeenCalled();
    expect(rsvpCreate).not.toHaveBeenCalled();

    consoleError.mockRestore();
  });

  it("does not finalize from a stored order id when redirect confirmation cannot reach Square", async () => {
    checkoutFindUnique.mockResolvedValue(buildCheckout());
    hasSquarePaymentConfiguration.mockReturnValue(false);

    await expect(
      confirmRegistrationCheckoutPayment("checkout-123"),
    ).resolves.toEqual({
      ok: false,
      reason: "unavailable",
      paymentUrl: "https://square.link/u/existing",
    });

    expect(dbTransaction).not.toHaveBeenCalled();
    expect(registrationUpsert).not.toHaveBeenCalled();
    expect(rsvpCreate).not.toHaveBeenCalled();
  });

  it("finalizes a checkout from a completed Square webhook order id", async () => {
    checkoutFindUnique.mockResolvedValue(buildCheckout());
    txCheckoutFindUnique.mockResolvedValue(buildCheckout());
    participantUpsert.mockResolvedValue({ id: "participant-1" });
    registrationUpsert.mockResolvedValue({ id: "registration-1" });
    rsvpFindUnique.mockResolvedValue(null);
    txCheckoutUpdate.mockResolvedValue({});

    await expect(
      confirmRegistrationCheckoutPaymentByOrderId(" order-123 "),
    ).resolves.toEqual({
      ok: true,
      registrationId: "registration-1",
    });

    expect(checkoutFindUnique).toHaveBeenCalledWith({
      where: { paymentOrderId: "order-123" },
    });
    expect(getRegistrationPaymentLinkState).not.toHaveBeenCalled();
    expect(registrationUpsert).toHaveBeenCalledWith({
      where: { paymentReference: "payment-link-1" },
      update: { paymentStatus: "CONFIRMED" },
      create: expect.objectContaining({
        paymentStatus: "CONFIRMED",
        paymentReference: "payment-link-1",
      }),
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

  it("does not create duplicates when a completed Square webhook is delivered again", async () => {
    checkoutFindUnique.mockResolvedValue(
      buildCheckout({
        status: "CONFIRMED",
        registrationId: "registration-1",
      }),
    );

    await expect(
      confirmRegistrationCheckoutPaymentByOrderId("order-123"),
    ).resolves.toEqual({
      ok: true,
      registrationId: "registration-1",
    });

    expect(dbTransaction).not.toHaveBeenCalled();
    expect(participantUpsert).not.toHaveBeenCalled();
    expect(registrationUpsert).not.toHaveBeenCalled();
    expect(rsvpCreate).not.toHaveBeenCalled();
  });

  it("does not finalize over an existing RSVP for the same email", async () => {
    checkoutFindUnique.mockResolvedValue(buildCheckout());
    getRegistrationPaymentLinkState.mockResolvedValue({
      reference: "payment-link-1",
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

    expect(rsvpFindUnique).toHaveBeenCalledWith({
      where: { email: "pat@example.com" },
      select: { id: true },
    });
    expect(participantUpsert).not.toHaveBeenCalled();
    expect(registrationUpsert).not.toHaveBeenCalled();
    expect(rsvpCreate).not.toHaveBeenCalled();
    expect(rsvpUpdate).not.toHaveBeenCalled();
    expect(txCheckoutUpdate).not.toHaveBeenCalled();
    expect(checkoutUpdate).toHaveBeenLastCalledWith({
      where: { id: "checkout-123" },
      data: {
        status: "PAYMENT_REVIEW",
        paymentReviewReason:
          "Square return reconciliation showed this checkout as paid, but local registration finalization did not complete.",
        paymentCompletedAt: expect.any(Date),
        lastReconciledAt: expect.any(Date),
      },
      select: { registrationId: true },
    });
  });

  it("creates a REGISTRATION RSVP when no FORM RSVP exists and dayBeforeRsvp is true", async () => {
    checkoutFindUnique.mockResolvedValue(buildCheckout());
    getRegistrationPaymentLinkState.mockResolvedValue({
      reference: "payment-link-1",
      url: "https://square.link/u/existing",
      orderState: "COMPLETED",
      isComplete: true,
    });
    hasSquarePaymentConfiguration.mockReturnValue(true);
    txCheckoutFindUnique.mockResolvedValue(buildCheckout());
    participantUpsert.mockResolvedValue({ id: "participant-1" });
    registrationUpsert.mockResolvedValue({ id: "registration-1" });
    rsvpFindUnique.mockResolvedValue(null);
    txCheckoutUpdate.mockResolvedValue({});

    await expect(
      confirmRegistrationCheckoutPayment("checkout-123"),
    ).resolves.toEqual({
      ok: true,
      registrationId: "registration-1",
    });

    expect(rsvpFindUnique).toHaveBeenCalledWith({
      where: { email: "pat@example.com" },
      select: { id: true, participantId: true },
    });
    expect(rsvpCreate).toHaveBeenCalledWith({
      data: {
        participantId: "participant-1",
        source: "REGISTRATION",
        firstName: "Pat",
        lastName: "Golfer",
        email: "pat@example.com",
        attending: true,
        adultAttendeeCount: 3,
        childAttendeeCount: 1,
        attendeeCount: 4,
      },
    });
    expect(rsvpUpdate).not.toHaveBeenCalled();
  });

  it("does not create a REGISTRATION RSVP when dayBeforeRsvp is false", async () => {
    const payloadWithoutRsvp = { ...payload, dayBeforeRsvp: false };
    checkoutFindUnique.mockResolvedValue(
      buildCheckout({ payload: payloadWithoutRsvp }),
    );
    getRegistrationPaymentLinkState.mockResolvedValue({
      reference: "payment-link-1",
      url: "https://square.link/u/existing",
      orderState: "COMPLETED",
      isComplete: true,
    });
    hasSquarePaymentConfiguration.mockReturnValue(true);
    txCheckoutFindUnique.mockResolvedValue(
      buildCheckout({ payload: payloadWithoutRsvp }),
    );
    participantUpsert.mockResolvedValue({ id: "participant-1" });
    registrationUpsert.mockResolvedValue({ id: "registration-1" });
    rsvpFindUnique.mockResolvedValue(null);
    txCheckoutUpdate.mockResolvedValue({});

    await expect(
      confirmRegistrationCheckoutPayment("checkout-123"),
    ).resolves.toEqual({
      ok: true,
      registrationId: "registration-1",
    });

    expect(rsvpFindUnique).toHaveBeenCalledWith({
      where: { email: "pat@example.com" },
      select: { id: true },
    });
    expect(rsvpCreate).not.toHaveBeenCalled();
    expect(rsvpUpdate).not.toHaveBeenCalled();
  });
});
