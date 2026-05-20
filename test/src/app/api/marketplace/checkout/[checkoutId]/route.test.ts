import { afterEach, describe, expect, it, vi } from "vitest";

const { getMarketplaceCheckoutPayment } = vi.hoisted(() => ({
  getMarketplaceCheckoutPayment: vi.fn(),
}));

vi.mock("@/lib/marketplaceCheckout", () => ({
  getMarketplaceCheckoutPayment,
}));

import { GET } from "@/app/api/marketplace/checkout/[checkoutId]/route";

function buildContext(checkoutId: string) {
  return {
    params: Promise.resolve({ checkoutId }),
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("marketplace checkout status route", () => {
  it("returns invalid for malformed checkout ids without calling the service", async () => {
    const response = await GET(
      new Request("http://localhost:3000/api/marketplace/checkout/%20%20"),
      buildContext("   "),
    );

    await expect(response.json()).resolves.toEqual({
      ok: false,
      status: "invalid",
    });
    expect(response.status).toBe(400);
    expect(getMarketplaceCheckoutPayment).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("returns confirmed when the marketplace order is finalized", async () => {
    getMarketplaceCheckoutPayment.mockResolvedValue({
      ok: true,
      status: "confirmed",
      checkoutId: "checkout-123",
      orderId: "order-123",
      paymentUrl: null,
    });

    const response = await GET(
      new Request(
        "http://localhost:3000/api/marketplace/checkout/checkout-123",
      ),
      buildContext("checkout-123"),
    );

    await expect(response.json()).resolves.toEqual({
      ok: true,
      status: "confirmed",
      orderId: "order-123",
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(getMarketplaceCheckoutPayment).toHaveBeenCalledWith("checkout-123");
  });

  it("returns pending with the hosted payment link while checkout payment is still open", async () => {
    getMarketplaceCheckoutPayment.mockResolvedValue({
      ok: true,
      status: "pending",
      checkoutId: "checkout-123",
      paymentAttemptId: "attempt-123",
      paymentReference: "reference-123",
      paymentUrl: "https://square.link/u/marketplace-checkout",
    });

    const response = await GET(
      new Request(
        "http://localhost:3000/api/marketplace/checkout/checkout-123",
      ),
      buildContext("checkout-123"),
    );

    await expect(response.json()).resolves.toEqual({
      ok: true,
      status: "pending",
      paymentUrl: "https://square.link/u/marketplace-checkout",
    });
    expect(response.status).toBe(200);
  });

  it("returns review when the marketplace checkout requires manual follow-up", async () => {
    getMarketplaceCheckoutPayment.mockResolvedValue({
      ok: false,
      reason: "review",
    });

    const response = await GET(
      new Request(
        "http://localhost:3000/api/marketplace/checkout/checkout-123",
      ),
      buildContext("checkout-123"),
    );

    await expect(response.json()).resolves.toEqual({
      ok: true,
      status: "review",
    });
    expect(response.status).toBe(200);
  });

  it("returns expired when the marketplace checkout can no longer be paid", async () => {
    getMarketplaceCheckoutPayment.mockResolvedValue({
      ok: false,
      reason: "expired",
    });

    const response = await GET(
      new Request(
        "http://localhost:3000/api/marketplace/checkout/checkout-123",
      ),
      buildContext("checkout-123"),
    );

    await expect(response.json()).resolves.toEqual({
      ok: true,
      status: "expired",
    });
    expect(response.status).toBe(200);
  });

  it("returns not_found for unknown checkout ids", async () => {
    getMarketplaceCheckoutPayment.mockResolvedValue({
      ok: false,
      reason: "not_found",
    });

    const response = await GET(
      new Request("http://localhost:3000/api/marketplace/checkout/missing"),
      buildContext("missing"),
    );

    await expect(response.json()).resolves.toEqual({
      ok: false,
      status: "not_found",
    });
    expect(response.status).toBe(404);
  });

  it("returns unavailable when marketplace payment status cannot be refreshed safely", async () => {
    getMarketplaceCheckoutPayment.mockResolvedValue({
      ok: false,
      reason: "unavailable",
    });

    const response = await GET(
      new Request(
        "http://localhost:3000/api/marketplace/checkout/checkout-123",
      ),
      buildContext("checkout-123"),
    );

    await expect(response.json()).resolves.toEqual({
      ok: true,
      status: "unavailable",
    });
    expect(response.status).toBe(200);
  });
});
