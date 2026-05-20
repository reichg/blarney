import { createHmac } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  confirmMarketplaceCheckoutPaymentByOrderId,
  confirmRegistrationCheckoutPaymentByOrderId,
  confirmRsvpCheckoutPaymentByOrderId,
} = vi.hoisted(() => ({
  confirmMarketplaceCheckoutPaymentByOrderId: vi.fn(),
  confirmRegistrationCheckoutPaymentByOrderId: vi.fn(),
  confirmRsvpCheckoutPaymentByOrderId: vi.fn(),
}));

vi.mock("@/lib/marketplaceCheckout", () => ({
  confirmMarketplaceCheckoutPaymentByOrderId,
}));

vi.mock("@/lib/registrationCheckout", () => ({
  confirmRegistrationCheckoutPaymentByOrderId,
}));

vi.mock("@/lib/rsvpCheckout", () => ({
  confirmRsvpCheckoutPaymentByOrderId,
}));

import { POST } from "@/app/api/square/webhook/route";

const notificationUrl = "https://example.com/api/square/webhook";
const signatureKey = "square-webhook-secret";

function signBody(rawBody: string) {
  return createHmac("sha256", signatureKey)
    .update(`${notificationUrl}${rawBody}`)
    .digest("base64");
}

function buildRequest(rawBody: string, signature = signBody(rawBody)) {
  return new Request(notificationUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-square-hmacsha256-signature": signature,
    },
    body: rawBody,
  });
}

function buildWebhookBody(overrides = {}) {
  return JSON.stringify({
    type: "payment.updated",
    data: {
      object: {
        payment: {
          id: "payment-123",
          order_id: "order-123",
          status: "COMPLETED",
          ...overrides,
        },
      },
    },
  });
}

function buildOrderWebhookBody(overrides = {}) {
  return JSON.stringify({
    type: "order.updated",
    data: {
      object: {
        order: {
          id: "order-123",
          state: "OPEN",
          tenders: [
            {
              id: "tender-123",
              payment_id: "payment-123",
            },
          ],
          net_amount_due_money: {
            amount: 0,
            currency: "USD",
          },
          ...overrides,
        },
      },
    },
  });
}

beforeEach(() => {
  vi.stubEnv("SQUARE_WEBHOOK_SIGNATURE_KEY", signatureKey);
  vi.stubEnv("SQUARE_WEBHOOK_NOTIFICATION_URL", notificationUrl);
  confirmMarketplaceCheckoutPaymentByOrderId.mockResolvedValue({
    ok: false,
    reason: "not_found",
  });
  confirmRsvpCheckoutPaymentByOrderId.mockResolvedValue({
    ok: false,
    reason: "invalid",
  });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("Square payment webhook route", () => {
  it("accepts a valid Square signature", async () => {
    const rawBody = JSON.stringify({ type: "customer.created" });

    const response = await POST(buildRequest(rawBody));

    await expect(response.json()).resolves.toEqual({
      ok: true,
      status: "ignored",
    });
    expect(response.status).toBe(200);
    expect(confirmRegistrationCheckoutPaymentByOrderId).not.toHaveBeenCalled();
    expect(confirmMarketplaceCheckoutPaymentByOrderId).not.toHaveBeenCalled();
  });

  it("rejects an invalid Square signature", async () => {
    const response = await POST(buildRequest(buildWebhookBody(), "invalid"));

    await expect(response.json()).resolves.toEqual({
      ok: false,
      status: "invalid_signature",
    });
    expect(response.status).toBe(401);
    expect(confirmRegistrationCheckoutPaymentByOrderId).not.toHaveBeenCalled();
    expect(confirmMarketplaceCheckoutPaymentByOrderId).not.toHaveBeenCalled();
  });

  it("materializes a checkout when Square reports a completed payment", async () => {
    confirmRegistrationCheckoutPaymentByOrderId.mockResolvedValue({
      ok: true,
      registrationId: "registration-123",
    });

    const response = await POST(buildRequest(buildWebhookBody()));

    expect(confirmRegistrationCheckoutPaymentByOrderId).toHaveBeenCalledWith(
      "order-123",
    );
    await expect(response.json()).resolves.toEqual({
      ok: true,
      status: "confirmed",
      registrationId: "registration-123",
    });
    expect(response.status).toBe(200);
  });

  it("materializes an RSVP checkout when no registration checkout matches", async () => {
    confirmRegistrationCheckoutPaymentByOrderId.mockResolvedValue({
      ok: false,
      reason: "invalid",
    });
    confirmRsvpCheckoutPaymentByOrderId.mockResolvedValue({
      ok: true,
      rsvpId: "rsvp-123",
    });

    const response = await POST(buildRequest(buildWebhookBody()));

    expect(confirmRegistrationCheckoutPaymentByOrderId).toHaveBeenCalledWith(
      "order-123",
    );
    expect(confirmRsvpCheckoutPaymentByOrderId).toHaveBeenCalledWith(
      "order-123",
    );
    await expect(response.json()).resolves.toEqual({
      ok: true,
      status: "confirmed",
      rsvpId: "rsvp-123",
    });
    expect(response.status).toBe(200);
  });

  it("materializes a marketplace order when no registration or RSVP checkout matches", async () => {
    confirmRegistrationCheckoutPaymentByOrderId.mockResolvedValue({
      ok: false,
      reason: "invalid",
    });
    confirmRsvpCheckoutPaymentByOrderId.mockResolvedValue({
      ok: false,
      reason: "invalid",
    });
    confirmMarketplaceCheckoutPaymentByOrderId.mockResolvedValue({
      ok: true,
      status: "confirmed",
      checkoutId: "checkout-123",
      orderId: "marketplace-order-123",
      paymentUrl: null,
    });

    const response = await POST(buildRequest(buildWebhookBody()));

    expect(confirmRegistrationCheckoutPaymentByOrderId).toHaveBeenCalledWith(
      "order-123",
    );
    expect(confirmRsvpCheckoutPaymentByOrderId).toHaveBeenCalledWith(
      "order-123",
    );
    expect(confirmMarketplaceCheckoutPaymentByOrderId).toHaveBeenCalledWith(
      "order-123",
    );
    await expect(response.json()).resolves.toEqual({
      ok: true,
      status: "confirmed",
      orderId: "marketplace-order-123",
    });
    expect(response.status).toBe(200);
  });

  it("ignores non-completed payments without materializing a checkout", async () => {
    const response = await POST(
      buildRequest(buildWebhookBody({ status: "APPROVED" })),
    );

    await expect(response.json()).resolves.toEqual({
      ok: true,
      status: "ignored",
    });
    expect(confirmRegistrationCheckoutPaymentByOrderId).not.toHaveBeenCalled();
    expect(confirmMarketplaceCheckoutPaymentByOrderId).not.toHaveBeenCalled();
  });

  it("materializes a checkout from a paid order update", async () => {
    confirmRegistrationCheckoutPaymentByOrderId.mockResolvedValue({
      ok: true,
      registrationId: "registration-123",
    });

    const response = await POST(buildRequest(buildOrderWebhookBody()));

    expect(confirmRegistrationCheckoutPaymentByOrderId).toHaveBeenCalledWith(
      "order-123",
    );
    await expect(response.json()).resolves.toEqual({
      ok: true,
      status: "confirmed",
      registrationId: "registration-123",
    });
    expect(response.status).toBe(200);
  });

  it("ignores unpaid order updates without materializing a checkout", async () => {
    const response = await POST(
      buildRequest(
        buildOrderWebhookBody({
          tenders: [],
          net_amount_due_money: {
            amount: 17500,
            currency: "USD",
          },
        }),
      ),
    );

    await expect(response.json()).resolves.toEqual({
      ok: true,
      status: "ignored",
    });
    expect(confirmRegistrationCheckoutPaymentByOrderId).not.toHaveBeenCalled();
    expect(confirmMarketplaceCheckoutPaymentByOrderId).not.toHaveBeenCalled();
  });

  it("ignores unknown Square orders safely", async () => {
    confirmRegistrationCheckoutPaymentByOrderId.mockResolvedValue({
      ok: false,
      reason: "invalid",
    });
    confirmRsvpCheckoutPaymentByOrderId.mockResolvedValue({
      ok: false,
      reason: "invalid",
    });

    const response = await POST(buildRequest(buildWebhookBody()));

    expect(confirmRegistrationCheckoutPaymentByOrderId).toHaveBeenCalledWith(
      "order-123",
    );
    expect(confirmRsvpCheckoutPaymentByOrderId).toHaveBeenCalledWith(
      "order-123",
    );
    expect(confirmMarketplaceCheckoutPaymentByOrderId).toHaveBeenCalledWith(
      "order-123",
    );
    await expect(response.json()).resolves.toEqual({
      ok: true,
      status: "ignored",
    });
    expect(response.status).toBe(200);
  });

  it("acknowledges marketplace confirmations that require manual review", async () => {
    confirmRegistrationCheckoutPaymentByOrderId.mockResolvedValue({
      ok: false,
      reason: "invalid",
    });
    confirmRsvpCheckoutPaymentByOrderId.mockResolvedValue({
      ok: false,
      reason: "invalid",
    });
    confirmMarketplaceCheckoutPaymentByOrderId.mockResolvedValue({
      ok: false,
      reason: "review",
    });

    const response = await POST(buildRequest(buildWebhookBody()));

    await expect(response.json()).resolves.toEqual({
      ok: true,
      status: "review",
    });
    expect(response.status).toBe(200);
  });

  it("acknowledges paid checkouts that need manual review", async () => {
    confirmRegistrationCheckoutPaymentByOrderId.mockResolvedValue({
      ok: false,
      reason: "review",
    });

    const response = await POST(buildRequest(buildWebhookBody()));

    await expect(response.json()).resolves.toEqual({
      ok: true,
      status: "review",
    });
    expect(response.status).toBe(200);
  });
});
