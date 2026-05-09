import RegisterThanksPage from "@/app/register/thanks/page";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const { redirectMock, registrationCheckoutFindUnique, registrationFindUnique } =
  vi.hoisted(() => ({
    redirectMock: vi.fn(),
    registrationCheckoutFindUnique: vi.fn(),
    registrationFindUnique: vi.fn(),
  }));

vi.mock("@/app/forms.module.css", () => ({
  default: new Proxy(
    {},
    {
      get: (_, key) => String(key),
    },
  ),
}));

vi.mock("@/app/register/thanks/RegistrationConfirmationPoller", () => ({
  RegistrationConfirmationPoller: ({
    checkoutId,
    statusPath,
  }: {
    checkoutId: string;
    statusPath?: string;
  }) =>
    createElement(
      "div",
      null,
      `poller:${statusPath ?? `/api/register/checkout/${checkoutId}`}`,
    ),
}));

vi.mock("@/lib/db", () => ({
  db: {
    registration: {
      findUnique: registrationFindUnique,
    },
    registrationCheckout: {
      findUnique: registrationCheckoutFindUnique,
    },
  },
}));

vi.mock("@/lib/payment", () => ({
  getOptionalRegistrationPaymentBreakdown: () => null,
  getRegistrationCheckoutPaymentPath: (checkoutId: string) =>
    `/register/payment?checkout=${encodeURIComponent(checkoutId)}`,
  hasSquarePaymentConfiguration: () => true,
  isCompleteRegistrationPaymentStatus: (status: string) =>
    status === "CONFIRMED" || status === "WAIVED",
}));

vi.mock("@/lib/registrationCheckout", () => ({
  registrationCheckoutPayloadSchema: {
    safeParse: (value: unknown) => ({ success: true, data: value }),
  },
}));

vi.mock("@/lib/registrationPayment", () => ({
  reconcileRegistrationPayment: vi.fn(),
}));

vi.mock("lucide-react", () => ({
  CreditCard: () => createElement("svg"),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("RegisterThanksPage", () => {
  it("renders the confirmation poller while payment confirmation is still processing", async () => {
    registrationCheckoutFindUnique.mockResolvedValue({
      registrationId: null,
      status: "PENDING",
    });
    registrationFindUnique.mockResolvedValue(null);

    const html = renderToStaticMarkup(
      await RegisterThanksPage({
        searchParams: Promise.resolve({
          payment: "processing",
          checkout: "checkout-123",
        }),
      }),
    );

    expect(html).toContain("Confirming payment.");
    expect(html).toContain("poller:/api/register/checkout/checkout-123");
    expect(html).not.toContain("Return to existing checkout");
  });

  it("renders a retry checkout action only when the payment state is explicitly retryable", async () => {
    registrationCheckoutFindUnique.mockResolvedValue({
      registrationId: null,
      status: "PENDING",
    });
    registrationFindUnique.mockResolvedValue(null);

    const html = renderToStaticMarkup(
      await RegisterThanksPage({
        searchParams: Promise.resolve({
          payment: "retry",
          checkout: "checkout-123",
        }),
      }),
    );

    expect(html).toContain("Payment not finished yet.");
    expect(html).toContain("Return to existing checkout");
  });

  it("keeps polling when Square verification is temporarily unavailable", async () => {
    registrationCheckoutFindUnique.mockResolvedValue({
      registrationId: null,
      status: "PENDING",
    });
    registrationFindUnique.mockResolvedValue(null);

    const html = renderToStaticMarkup(
      await RegisterThanksPage({
        searchParams: Promise.resolve({
          payment: "unavailable",
          checkout: "checkout-123",
        }),
      }),
    );

    expect(html).toContain("We can&#x27;t verify this payment yet.");
    expect(html).toContain("poller:/api/register/checkout/checkout-123");
    expect(html).not.toContain("Return to existing checkout");
  });
});
