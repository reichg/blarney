import { afterEach, describe, expect, it, vi } from "vitest";

const { createMarketplaceCheckoutPayment } = vi.hoisted(() => ({
  createMarketplaceCheckoutPayment: vi.fn(),
}));

vi.mock("@/lib/marketplaceCheckout", () => ({
  createMarketplaceCheckoutPayment,
}));

import { POST } from "@/app/api/marketplace/checkout/route";

function buildRequest(body: unknown) {
  return new Request("http://localhost:3000/api/marketplace/checkout", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("marketplace checkout create route", () => {
  it("returns invalid for malformed bodies without calling the service", async () => {
    const response = await POST(
      new Request("http://localhost:3000/api/marketplace/checkout", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: "{not-json",
      }),
    );

    await expect(response.json()).resolves.toEqual({
      ok: false,
      status: "invalid",
    });
    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(createMarketplaceCheckoutPayment).not.toHaveBeenCalled();
  });

  it("creates a marketplace checkout and returns a safe Square payment handoff", async () => {
    createMarketplaceCheckoutPayment.mockResolvedValue({
      ok: true,
      status: "pending",
      checkoutId: "checkout-123",
      paymentAttemptId: "attempt-123",
      paymentReference: "reference-123",
      paymentUrl: "https://square.link/u/marketplace-checkout",
    });

    const response = await POST(
      buildRequest({
        items: [{ variantId: "variant-hoodie-m", quantity: 2 }],
        customer: {
          email: "buyer@example.com",
          name: "Pat Buyer",
          phone: "555-0100",
        },
      }),
    );

    await expect(response.json()).resolves.toEqual({
      ok: true,
      status: "pending",
      checkoutId: "checkout-123",
      paymentUrl: "https://square.link/u/marketplace-checkout",
    });
    expect(response.status).toBe(200);
    expect(createMarketplaceCheckoutPayment).toHaveBeenCalledWith({
      items: [{ variantId: "variant-hoodie-m", quantity: 2 }],
      customer: {
        email: "buyer@example.com",
        name: "Pat Buyer",
        phone: "555-0100",
      },
      requestSnapshot: {
        source: "marketplace-ui",
      },
    });
  });

  it("rejects untrusted checkout handoff urls from the provider layer", async () => {
    createMarketplaceCheckoutPayment.mockResolvedValue({
      ok: true,
      status: "pending",
      checkoutId: "checkout-123",
      paymentAttemptId: "attempt-123",
      paymentReference: "reference-123",
      paymentUrl: "http://evil.example/checkout",
    });

    const response = await POST(
      buildRequest({
        items: [{ variantId: "variant-hoodie-m", quantity: 1 }],
        customer: {
          email: "buyer@example.com",
          name: "Pat Buyer",
          phone: null,
        },
      }),
    );

    await expect(response.json()).resolves.toEqual({
      ok: true,
      status: "unavailable",
    });
    expect(response.status).toBe(200);
  });

  it("returns confirmed when the marketplace order is already finalized", async () => {
    createMarketplaceCheckoutPayment.mockResolvedValue({
      ok: true,
      status: "confirmed",
      checkoutId: "checkout-123",
      orderId: "order-123",
      paymentUrl: null,
    });

    const response = await POST(
      buildRequest({
        items: [{ variantId: "variant-hoodie-m", quantity: 1 }],
        customer: {
          email: "buyer@example.com",
          name: "Pat Buyer",
          phone: null,
        },
      }),
    );

    await expect(response.json()).resolves.toEqual({
      ok: true,
      status: "confirmed",
      orderId: "order-123",
    });
    expect(response.status).toBe(200);
  });

  it("returns unavailable_items when the cart changed before checkout creation", async () => {
    createMarketplaceCheckoutPayment.mockResolvedValue({
      ok: false,
      reason: "unavailable_items",
    });

    const response = await POST(
      buildRequest({
        items: [{ variantId: "variant-hoodie-m", quantity: 4 }],
        customer: {
          email: "buyer@example.com",
          name: "Pat Buyer",
          phone: null,
        },
      }),
    );

    await expect(response.json()).resolves.toEqual({
      ok: false,
      status: "unavailable_items",
    });
    expect(response.status).toBe(409);
  });
});
