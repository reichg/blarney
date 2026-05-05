import {
  createRegistrationPaymentConfirmationToken,
  createRegistrationPaymentLink,
  createRsvpPaymentLink,
  getRegistrationPaymentBreakdown,
  getRegistrationPaymentLinkState,
  getRsvpPaymentBreakdown,
  hasSquarePaymentConfiguration,
  verifyRegistrationPaymentConfirmationToken,
  verifyRsvpPaymentConfirmationToken,
} from "@/lib/payment";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("registration payment pricing", () => {
  it("adds golfers, BBQ-only adults, and BBQ-only kids to the total", () => {
    vi.stubEnv("REGISTRATION_GOLF_PRICE_CENTS", "12500");
    vi.stubEnv("REGISTRATION_BBQ_ADULT_PRICE_CENTS", "3500");
    vi.stubEnv("REGISTRATION_BBQ_KID_PRICE_CENTS", "1500");

    const breakdown = getRegistrationPaymentBreakdown({
      golferCount: 3,
      bbqOnlyAdultCount: 2,
      bbqOnlyKidCount: 1,
    });

    expect(breakdown.golferCount).toBe(3);
    expect(breakdown.golfPriceCents).toBe(12500);
    expect(breakdown.adultGuestPriceCents).toBe(3500);
    expect(breakdown.childGuestPriceCents).toBe(1500);
    expect(breakdown.totalCents).toBe(46000);
    expect(breakdown.totalLabel).toBe("$460.00");
    expect(breakdown.lineItems).toHaveLength(3);
  });

  it("keeps legacy pre-event price env names as BBQ pricing fallback", () => {
    vi.stubEnv("REGISTRATION_GOLF_PRICE_CENTS", "12500");
    vi.stubEnv("REGISTRATION_PRE_EVENT_ADULT_PRICE_CENTS", "3500");
    vi.stubEnv("REGISTRATION_PRE_EVENT_CHILD_PRICE_CENTS", "1500");

    const breakdown = getRegistrationPaymentBreakdown({
      golferCount: 1,
      bbqOnlyAdultCount: 1,
      bbqOnlyKidCount: 1,
    });

    expect(breakdown.totalCents).toBe(17500);
    expect(breakdown.lineItems).toEqual([
      expect.objectContaining({
        label: "Golf registration (BBQ included)",
        quantity: 1,
      }),
      expect.objectContaining({ label: "BBQ-only adults", quantity: 1 }),
      expect.objectContaining({ label: "BBQ-only kids", quantity: 1 }),
    ]);
  });

  it("adds RSVP-only adult and child attendees without a golf line item", () => {
    vi.stubEnv("REGISTRATION_GOLF_PRICE_CENTS", "12500");
    vi.stubEnv("REGISTRATION_PRE_EVENT_ADULT_PRICE_CENTS", "3500");
    vi.stubEnv("REGISTRATION_PRE_EVENT_CHILD_PRICE_CENTS", "1500");

    const breakdown = getRsvpPaymentBreakdown({
      adultAttendeeCount: 2,
      childAttendeeCount: 1,
    });

    expect(breakdown.totalCents).toBe(8500);
    expect(breakdown.totalLabel).toBe("$85.00");
    expect(breakdown.lineItems).toEqual([
      expect.objectContaining({ label: "BBQ-only adults", quantity: 2 }),
      expect.objectContaining({ label: "BBQ-only kids", quantity: 1 }),
    ]);
  });

  it("requires at least one RSVP attendee for payment", () => {
    vi.stubEnv("REGISTRATION_GOLF_PRICE_CENTS", "12500");
    vi.stubEnv("REGISTRATION_PRE_EVENT_ADULT_PRICE_CENTS", "3500");
    vi.stubEnv("REGISTRATION_PRE_EVENT_CHILD_PRICE_CENTS", "1500");

    expect(() =>
      getRsvpPaymentBreakdown({
        adultAttendeeCount: 0,
        childAttendeeCount: 0,
      }),
    ).toThrow("At least one RSVP attendee is required for payment.");
  });

  it("requires a positive golf price", () => {
    vi.stubEnv("REGISTRATION_GOLF_PRICE_CENTS", "0");
    vi.stubEnv("REGISTRATION_PRE_EVENT_ADULT_PRICE_CENTS", "3500");
    vi.stubEnv("REGISTRATION_PRE_EVENT_CHILD_PRICE_CENTS", "1500");

    expect(() =>
      getRegistrationPaymentBreakdown({
        adultGuestCount: 0,
        childGuestCount: 0,
      }),
    ).toThrow("REGISTRATION_GOLF_PRICE_CENTS must be an integer >= 1.");
  });

  it("requires price values to be strict integers", () => {
    vi.stubEnv("REGISTRATION_GOLF_PRICE_CENTS", "12500abc");
    vi.stubEnv("REGISTRATION_PRE_EVENT_ADULT_PRICE_CENTS", "3500");
    vi.stubEnv("REGISTRATION_PRE_EVENT_CHILD_PRICE_CENTS", "1500");

    expect(() =>
      getRegistrationPaymentBreakdown({
        adultGuestCount: 0,
        childGuestCount: 0,
      }),
    ).toThrow("REGISTRATION_GOLF_PRICE_CENTS must be an integer >= 1.");
  });

  it("creates a Square payment link with explicit order line items", async () => {
    vi.stubEnv("REGISTRATION_GOLF_PRICE_CENTS", "12500");
    vi.stubEnv("REGISTRATION_PRE_EVENT_ADULT_PRICE_CENTS", "3500");
    vi.stubEnv("REGISTRATION_PRE_EVENT_CHILD_PRICE_CENTS", "1500");
    vi.stubEnv("ADMIN_SESSION_SECRET", "payment-confirmation-secret");
    vi.stubEnv("SQUARE_ENVIRONMENT", "sandbox");
    vi.stubEnv("SQUARE_ACCESS_TOKEN", "sandbox-token");
    vi.stubEnv("SQUARE_LOCATION_ID", "location-id");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        payment_link: {
          id: "payment-link-id",
          order_id: "order-123",
          url: "https://square.link/u/example",
        },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createRegistrationPaymentLink({
        checkoutId: "checkout-123",
        email: "player@example.com",
        adultGuestCount: 2,
        childGuestCount: 1,
      }),
    ).resolves.toEqual({
      reference: "payment-link-id",
      orderId: "order-123",
      url: "https://square.link/u/example",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://connect.squareupsandbox.com/v2/online-checkout/payment-links",
      expect.objectContaining({
        method: "POST",
      }),
    );

    const [, requestInit] = fetchMock.mock.calls[0];
    const body = JSON.parse(requestInit.body as string);
    const redirectUrl = new URL(body.checkout_options.redirect_url);
    const confirmationToken = redirectUrl.searchParams.get("token");

    expect(body.order.line_items).toEqual([
      {
        name: "Golf registration (BBQ included)",
        quantity: "1",
        base_price_money: {
          amount: 12500,
          currency: "USD",
        },
      },
      {
        name: "BBQ-only adults",
        quantity: "2",
        base_price_money: {
          amount: 3500,
          currency: "USD",
        },
      },
      {
        name: "BBQ-only kids",
        quantity: "1",
        base_price_money: {
          amount: 1500,
          currency: "USD",
        },
      },
    ]);
    expect(redirectUrl.origin).toBe("http://localhost:3000");
    expect(redirectUrl.pathname).toBe("/register/payment/confirm");
    expect(redirectUrl.searchParams.get("checkout")).toBe("checkout-123");
    expect(typeof body.idempotency_key).toBe("string");
    expect(body.idempotency_key.length).toBeGreaterThan(0);
    await expect(
      verifyRegistrationPaymentConfirmationToken(confirmationToken),
    ).resolves.toEqual({ checkoutId: "checkout-123" });
    expect(body.quick_pay).toBeUndefined();
  });

  it("creates an RSVP-only Square payment link without golf line items", async () => {
    vi.stubEnv("REGISTRATION_GOLF_PRICE_CENTS", "12500");
    vi.stubEnv("REGISTRATION_PRE_EVENT_ADULT_PRICE_CENTS", "3500");
    vi.stubEnv("REGISTRATION_PRE_EVENT_CHILD_PRICE_CENTS", "1500");
    vi.stubEnv("ADMIN_SESSION_SECRET", "payment-confirmation-secret");
    vi.stubEnv("SQUARE_ENVIRONMENT", "sandbox");
    vi.stubEnv("SQUARE_ACCESS_TOKEN", "sandbox-token");
    vi.stubEnv("SQUARE_LOCATION_ID", "location-id");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        payment_link: {
          id: "payment-link-id",
          order_id: "order-123",
          url: "https://square.link/u/example",
        },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createRsvpPaymentLink({
        checkoutId: "rsvp-checkout-123",
        email: "family@example.com",
        adultAttendeeCount: 2,
        childAttendeeCount: 1,
      }),
    ).resolves.toEqual({
      reference: "payment-link-id",
      orderId: "order-123",
      url: "https://square.link/u/example",
    });

    const [, requestInit] = fetchMock.mock.calls[0];
    const body = JSON.parse(requestInit.body as string);
    const redirectUrl = new URL(body.checkout_options.redirect_url);
    const confirmationToken = redirectUrl.searchParams.get("token");

    expect(body.order.line_items).toEqual([
      {
        name: "BBQ-only adults",
        quantity: "2",
        base_price_money: {
          amount: 3500,
          currency: "USD",
        },
      },
      {
        name: "BBQ-only kids",
        quantity: "1",
        base_price_money: {
          amount: 1500,
          currency: "USD",
        },
      },
    ]);
    expect(redirectUrl.pathname).toBe("/register/payment/confirm");
    expect(redirectUrl.searchParams.get("rsvpCheckout")).toBe(
      "rsvp-checkout-123",
    );
    await expect(
      verifyRsvpPaymentConfirmationToken(confirmationToken),
    ).resolves.toEqual({ checkoutId: "rsvp-checkout-123" });
  });

  it("requires an explicit payment confirmation secret in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ADMIN_SESSION_SECRET", "admin-session-secret");

    await expect(
      createRegistrationPaymentConfirmationToken("checkout-123"),
    ).rejects.toThrow("SQUARE_PAYMENT_CONFIRMATION_SECRET must be configured.");
  });

  it("uses the same idempotency key for repeated link creation on one registration", async () => {
    vi.stubEnv("REGISTRATION_GOLF_PRICE_CENTS", "12500");
    vi.stubEnv("REGISTRATION_PRE_EVENT_ADULT_PRICE_CENTS", "3500");
    vi.stubEnv("REGISTRATION_PRE_EVENT_CHILD_PRICE_CENTS", "1500");
    vi.stubEnv("ADMIN_SESSION_SECRET", "payment-confirmation-secret");
    vi.stubEnv("SQUARE_ENVIRONMENT", "sandbox");
    vi.stubEnv("SQUARE_ACCESS_TOKEN", "sandbox-token");
    vi.stubEnv("SQUARE_LOCATION_ID", "location-id");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          payment_link: {
            id: "payment-link-id-1",
            url: "https://square.link/u/example-1",
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          payment_link: {
            id: "payment-link-id-2",
            url: "https://square.link/u/example-2",
          },
        }),
      });

    vi.stubGlobal("fetch", fetchMock);

    await createRegistrationPaymentLink({
      checkoutId: "checkout-123",
      email: "player@example.com",
      adultGuestCount: 0,
      childGuestCount: 0,
    });
    await createRegistrationPaymentLink({
      checkoutId: "checkout-123",
      email: "player@example.com",
      adultGuestCount: 0,
      childGuestCount: 0,
    });

    const firstBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body as string);

    expect(firstBody.idempotency_key).toBe(secondBody.idempotency_key);
  });

  it("reads an existing Square payment link and keeps pending links reusable", async () => {
    vi.stubEnv("SQUARE_ENVIRONMENT", "sandbox");
    vi.stubEnv("SQUARE_ACCESS_TOKEN", "sandbox-token");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        payment_link: {
          id: "payment-link-id",
          url: "https://square.link/u/example",
          order_id: "order-123",
        },
        related_resources: {
          orders: [
            {
              id: "order-123",
              state: "OPEN",
            },
          ],
        },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getRegistrationPaymentLinkState("payment-link-id"),
    ).resolves.toEqual({
      reference: "payment-link-id",
      orderId: "order-123",
      url: "https://square.link/u/example",
      orderState: "OPEN",
      isComplete: false,
    });
  });

  it("detects completed Square payment links from the related order state", async () => {
    vi.stubEnv("SQUARE_ENVIRONMENT", "sandbox");
    vi.stubEnv("SQUARE_ACCESS_TOKEN", "sandbox-token");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        payment_link: {
          id: "payment-link-id",
          url: "https://square.link/u/example",
          order_id: "order-123",
        },
        related_resources: {
          orders: [
            {
              id: "order-123",
              state: "COMPLETED",
            },
          ],
        },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getRegistrationPaymentLinkState("payment-link-id"),
    ).resolves.toEqual({
      reference: "payment-link-id",
      orderId: "order-123",
      url: "https://square.link/u/example",
      orderState: "COMPLETED",
      isComplete: true,
    });
  });

  it("detects fully paid related Square orders that remain open", async () => {
    vi.stubEnv("SQUARE_ENVIRONMENT", "sandbox");
    vi.stubEnv("SQUARE_ACCESS_TOKEN", "sandbox-token");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        payment_link: {
          id: "payment-link-id",
          url: "https://square.link/u/example",
          order_id: "order-123",
        },
        related_resources: {
          orders: [
            {
              id: "order-123",
              state: "OPEN",
              tenders: [{ id: "tender-123", payment_id: "payment-123" }],
              net_amount_due_money: {
                amount: 0,
                currency: "USD",
              },
            },
          ],
        },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getRegistrationPaymentLinkState("payment-link-id"),
    ).resolves.toEqual({
      reference: "payment-link-id",
      orderId: "order-123",
      url: "https://square.link/u/example",
      orderState: "OPEN",
      isComplete: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to the Square order and treats fully paid open orders as complete", async () => {
    vi.stubEnv("SQUARE_ENVIRONMENT", "sandbox");
    vi.stubEnv("SQUARE_ACCESS_TOKEN", "sandbox-token");

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          payment_link: {
            id: "payment-link-id",
            url: "https://square.link/u/example",
            order_id: "order-123",
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          order: {
            id: "order-123",
            state: "OPEN",
            tenders: [{ id: "tender-123", payment_id: "payment-123" }],
            net_amount_due_money: {
              amount: 0,
              currency: "USD",
            },
          },
        }),
      });

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getRegistrationPaymentLinkState("payment-link-id"),
    ).resolves.toEqual({
      reference: "payment-link-id",
      orderId: "order-123",
      url: "https://square.link/u/example",
      orderState: "OPEN",
      isComplete: true,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://connect.squareupsandbox.com/v2/orders/order-123",
      expect.objectContaining({
        method: "GET",
      }),
    );
  });

  it("treats missing Square payment links as unusable so callers can recreate them", async () => {
    vi.stubEnv("SQUARE_ENVIRONMENT", "sandbox");
    vi.stubEnv("SQUARE_ACCESS_TOKEN", "sandbox-token");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({
        errors: [
          {
            code: "NOT_FOUND",
            detail: "Payment link not found.",
          },
        ],
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getRegistrationPaymentLinkState("payment-link-id"),
    ).resolves.toBeNull();
  });

  it("requires Square credentials to create the payment link", async () => {
    vi.stubEnv("REGISTRATION_GOLF_PRICE_CENTS", "12500");
    vi.stubEnv("REGISTRATION_PRE_EVENT_ADULT_PRICE_CENTS", "3500");
    vi.stubEnv("REGISTRATION_PRE_EVENT_CHILD_PRICE_CENTS", "1500");
    vi.stubEnv("SQUARE_ACCESS_TOKEN", "");
    vi.stubEnv("SQUARE_LOCATION_ID", "");

    await expect(
      createRegistrationPaymentLink({
        checkoutId: "checkout-123",
        email: "player@example.com",
        adultGuestCount: 0,
        childGuestCount: 0,
      }),
    ).rejects.toThrow("SQUARE_ACCESS_TOKEN must be configured.");
  });

  it("rejects unknown Square environments", async () => {
    vi.stubEnv("REGISTRATION_GOLF_PRICE_CENTS", "12500");
    vi.stubEnv("REGISTRATION_PRE_EVENT_ADULT_PRICE_CENTS", "3500");
    vi.stubEnv("REGISTRATION_PRE_EVENT_CHILD_PRICE_CENTS", "1500");
    vi.stubEnv("ADMIN_SESSION_SECRET", "payment-confirmation-secret");
    vi.stubEnv("SQUARE_ENVIRONMENT", "staging");
    vi.stubEnv("SQUARE_ACCESS_TOKEN", "sandbox-token");
    vi.stubEnv("SQUARE_LOCATION_ID", "location-id");

    await expect(
      createRegistrationPaymentLink({
        checkoutId: "checkout-123",
        email: "player@example.com",
        adultGuestCount: 0,
        childGuestCount: 0,
      }),
    ).rejects.toThrow(
      "SQUARE_ENVIRONMENT must be either sandbox or production.",
    );
  });

  it("detects whether Square payment creation is configured", () => {
    vi.stubEnv("REGISTRATION_GOLF_PRICE_CENTS", "12500");
    vi.stubEnv("REGISTRATION_PRE_EVENT_ADULT_PRICE_CENTS", "3500");
    vi.stubEnv("REGISTRATION_PRE_EVENT_CHILD_PRICE_CENTS", "1500");
    vi.stubEnv("SQUARE_ACCESS_TOKEN", "sandbox-token");
    vi.stubEnv("SQUARE_LOCATION_ID", "location-id");

    expect(hasSquarePaymentConfiguration()).toBe(true);

    vi.stubEnv("SQUARE_ACCESS_TOKEN", "");

    expect(hasSquarePaymentConfiguration()).toBe(false);
  });

  it("round-trips a valid payment confirmation token and rejects tampering", async () => {
    vi.stubEnv(
      "SQUARE_PAYMENT_CONFIRMATION_SECRET",
      "payment-confirmation-secret",
    );

    const token =
      await createRegistrationPaymentConfirmationToken("checkout-123");

    await expect(
      verifyRegistrationPaymentConfirmationToken(token),
    ).resolves.toEqual({ checkoutId: "checkout-123" });
    await expect(
      verifyRegistrationPaymentConfirmationToken(`${token}tampered`),
    ).resolves.toBeNull();
  });
});
