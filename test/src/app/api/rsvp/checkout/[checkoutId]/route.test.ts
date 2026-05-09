import { afterEach, describe, expect, it, vi } from "vitest";

const { checkoutFindUnique, confirmRsvpCheckoutPayment } = vi.hoisted(() => ({
  checkoutFindUnique: vi.fn(),
  confirmRsvpCheckoutPayment: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    rsvpCheckout: {
      findUnique: checkoutFindUnique,
    },
  },
}));

vi.mock("@/lib/rsvpCheckout", () => ({
  confirmRsvpCheckoutPayment,
}));

import { GET } from "@/app/api/rsvp/checkout/[checkoutId]/route";

function buildContext(checkoutId: string) {
  return {
    params: Promise.resolve({ checkoutId }),
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("rsvp checkout status route", () => {
  it("returns a confirmed RSVP path without exposing checkout payload", async () => {
    checkoutFindUnique.mockResolvedValue({
      id: "rsvp-checkout-123",
      status: "CONFIRMED",
      rsvpId: "rsvp-123",
    });

    const response = await GET(
      new Request("http://localhost:3000/api/rsvp/checkout/rsvp-checkout-123"),
      buildContext("rsvp-checkout-123"),
    );

    await expect(response.json()).resolves.toEqual({
      ok: true,
      status: "confirmed",
      rsvpId: "rsvp-123",
      thanksPath: "/rsvp/thanks?rsvp=rsvp-123&payment=confirmed",
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(confirmRsvpCheckoutPayment).not.toHaveBeenCalled();
  });

  it("returns a retry path when checkout reconciliation shows payment is still open", async () => {
    checkoutFindUnique.mockResolvedValue({
      id: "rsvp-checkout-123",
      status: "PENDING",
      rsvpId: null,
    });
    confirmRsvpCheckoutPayment.mockResolvedValue({
      ok: false,
      reason: "retry",
      paymentUrl: "https://square.link/u/existing",
    });

    const response = await GET(
      new Request("http://localhost:3000/api/rsvp/checkout/rsvp-checkout-123"),
      buildContext("rsvp-checkout-123"),
    );

    await expect(response.json()).resolves.toEqual({
      ok: true,
      status: "retry",
      paymentPath: "/register/payment?rsvpCheckout=rsvp-checkout-123",
    });
  });

  it("returns review when a paid RSVP checkout needs chair review", async () => {
    checkoutFindUnique.mockResolvedValue({
      id: "rsvp-checkout-123",
      status: "PENDING",
      rsvpId: null,
    });
    confirmRsvpCheckoutPayment.mockResolvedValue({
      ok: false,
      reason: "review",
      paymentUrl: null,
    });

    const response = await GET(
      new Request("http://localhost:3000/api/rsvp/checkout/rsvp-checkout-123"),
      buildContext("rsvp-checkout-123"),
    );

    await expect(response.json()).resolves.toEqual({
      ok: true,
      status: "review",
    });
  });

  it("returns unavailable when RSVP checkout reconciliation cannot reach Square", async () => {
    checkoutFindUnique.mockResolvedValue({
      id: "rsvp-checkout-123",
      status: "PENDING",
      rsvpId: null,
    });
    confirmRsvpCheckoutPayment.mockResolvedValue({
      ok: false,
      reason: "unavailable",
    });

    const response = await GET(
      new Request("http://localhost:3000/api/rsvp/checkout/rsvp-checkout-123"),
      buildContext("rsvp-checkout-123"),
    );

    await expect(response.json()).resolves.toEqual({
      ok: true,
      status: "unavailable",
    });
  });
});
