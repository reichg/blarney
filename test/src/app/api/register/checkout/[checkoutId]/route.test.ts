import { afterEach, describe, expect, it, vi } from "vitest";

const { checkoutFindUnique, confirmRegistrationCheckoutPayment } = vi.hoisted(
  () => ({
    checkoutFindUnique: vi.fn(),
    confirmRegistrationCheckoutPayment: vi.fn(),
  }),
);

vi.mock("@/lib/db", () => ({
  db: {
    registrationCheckout: {
      findUnique: checkoutFindUnique,
    },
  },
}));

vi.mock("@/lib/registrationCheckout", () => ({
  confirmRegistrationCheckoutPayment,
}));

import { GET } from "@/app/api/register/checkout/[checkoutId]/route";

function buildContext(checkoutId: string) {
  return {
    params: Promise.resolve({ checkoutId }),
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("registration checkout status route", () => {
  it("returns a confirmed registration path without exposing checkout payload", async () => {
    checkoutFindUnique.mockResolvedValue({
      id: "checkout-123",
      status: "CONFIRMED",
      registrationId: "registration-123",
    });

    const response = await GET(
      new Request("http://localhost:3000/api/register/checkout/checkout-123"),
      buildContext("checkout-123"),
    );

    await expect(response.json()).resolves.toEqual({
      ok: true,
      status: "confirmed",
      registrationId: "registration-123",
      thanksPath:
        "/register/thanks?registration=registration-123&payment=confirmed",
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(checkoutFindUnique).toHaveBeenCalledWith({
      where: { id: "checkout-123" },
      select: {
        id: true,
        registrationId: true,
        status: true,
      },
    });
    expect(confirmRegistrationCheckoutPayment).not.toHaveBeenCalled();
  });

  it("returns confirmed when pending checkout reconciliation succeeds", async () => {
    checkoutFindUnique.mockResolvedValue({
      id: "checkout-123",
      status: "PENDING",
      registrationId: null,
    });
    confirmRegistrationCheckoutPayment.mockResolvedValue({
      ok: true,
      registrationId: "registration-123",
    });

    const response = await GET(
      new Request("http://localhost:3000/api/register/checkout/checkout-123"),
      buildContext("checkout-123"),
    );

    await expect(response.json()).resolves.toEqual({
      ok: true,
      status: "confirmed",
      registrationId: "registration-123",
      thanksPath:
        "/register/thanks?registration=registration-123&payment=confirmed",
    });
    expect(confirmRegistrationCheckoutPayment).toHaveBeenCalledWith(
      "checkout-123",
    );
  });

  it("returns processing while checkout reconciliation is still pending", async () => {
    checkoutFindUnique.mockResolvedValue({
      id: "checkout-123",
      status: "PENDING",
      registrationId: null,
    });
    confirmRegistrationCheckoutPayment.mockResolvedValue({
      ok: false,
      reason: "pending",
      paymentUrl: "https://square.link/u/existing",
    });

    const response = await GET(
      new Request("http://localhost:3000/api/register/checkout/checkout-123"),
      buildContext("checkout-123"),
    );

    await expect(response.json()).resolves.toEqual({
      ok: true,
      status: "processing",
      paymentPath: "/register/payment?checkout=checkout-123",
    });
    expect(confirmRegistrationCheckoutPayment).toHaveBeenCalledWith(
      "checkout-123",
    );
  });

  it("returns a retry path when checkout reconciliation shows payment is still open", async () => {
    checkoutFindUnique.mockResolvedValue({
      id: "checkout-123",
      status: "PENDING",
      registrationId: null,
    });
    confirmRegistrationCheckoutPayment.mockResolvedValue({
      ok: false,
      reason: "retry",
      paymentUrl: "https://square.link/u/existing",
    });

    const response = await GET(
      new Request("http://localhost:3000/api/register/checkout/checkout-123"),
      buildContext("checkout-123"),
    );

    await expect(response.json()).resolves.toEqual({
      ok: true,
      status: "retry",
      paymentPath: "/register/payment?checkout=checkout-123",
    });
  });

  it("returns not found for unknown checkout ids", async () => {
    checkoutFindUnique.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost:3000/api/register/checkout/missing"),
      buildContext("missing"),
    );

    await expect(response.json()).resolves.toEqual({
      ok: false,
      status: "not_found",
    });
    expect(response.status).toBe(404);
    expect(confirmRegistrationCheckoutPayment).not.toHaveBeenCalled();
  });

  it("returns invalid when pending checkout reconciliation cannot continue", async () => {
    checkoutFindUnique.mockResolvedValue({
      id: "checkout-123",
      status: "PENDING",
      registrationId: null,
    });
    confirmRegistrationCheckoutPayment.mockResolvedValue({
      ok: false,
      reason: "invalid",
    });

    const response = await GET(
      new Request("http://localhost:3000/api/register/checkout/checkout-123"),
      buildContext("checkout-123"),
    );

    await expect(response.json()).resolves.toEqual({
      ok: false,
      status: "invalid",
    });
    expect(response.status).toBe(400);
  });

  it("returns review when a paid checkout needs chair review", async () => {
    checkoutFindUnique.mockResolvedValue({
      id: "checkout-123",
      status: "PENDING",
      registrationId: null,
    });
    confirmRegistrationCheckoutPayment.mockResolvedValue({
      ok: false,
      reason: "review",
      paymentUrl: null,
    });

    const response = await GET(
      new Request("http://localhost:3000/api/register/checkout/checkout-123"),
      buildContext("checkout-123"),
    );

    await expect(response.json()).resolves.toEqual({
      ok: true,
      status: "review",
    });
  });

  it("returns unavailable when checkout reconciliation cannot reach Square", async () => {
    checkoutFindUnique.mockResolvedValue({
      id: "checkout-123",
      status: "PENDING",
      registrationId: null,
    });
    confirmRegistrationCheckoutPayment.mockResolvedValue({
      ok: false,
      reason: "unavailable",
    });

    const response = await GET(
      new Request("http://localhost:3000/api/register/checkout/checkout-123"),
      buildContext("checkout-123"),
    );

    await expect(response.json()).resolves.toEqual({
      ok: true,
      status: "unavailable",
    });
  });
});
