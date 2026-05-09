import RsvpThanksPage from "@/app/rsvp/thanks/page";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const { redirectMock, rsvpCheckoutFindUnique, rsvpFindUnique } = vi.hoisted(
  () => ({
    redirectMock: vi.fn(),
    rsvpCheckoutFindUnique: vi.fn(),
    rsvpFindUnique: vi.fn(),
  }),
);

vi.mock("@/app/forms.module.css", () => ({
  default: new Proxy(
    {},
    {
      get: (_, key) => String(key),
    },
  ),
}));

vi.mock("@/app/register/thanks/RegistrationConfirmationPoller", () => ({
  RegistrationConfirmationPoller: ({ statusPath }: { statusPath: string }) =>
    createElement("div", null, `poller:${statusPath}`),
}));

vi.mock("@/lib/db", () => ({
  db: {
    rsvp: {
      findUnique: rsvpFindUnique,
    },
    rsvpCheckout: {
      findUnique: rsvpCheckoutFindUnique,
    },
  },
}));

vi.mock("@/lib/payment", () => ({
  getRsvpCheckoutPaymentPath: (checkoutId: string) =>
    `/register/payment?rsvpCheckout=${encodeURIComponent(checkoutId)}`,
  getRsvpPaymentBreakdown: ({
    adultAttendeeCount,
    childAttendeeCount,
  }: {
    adultAttendeeCount: number;
    childAttendeeCount: number;
  }) => ({
    totalLabel: "$85.00",
    lineItems: [
      {
        label: "BBQ-only adults",
        quantity: adultAttendeeCount,
        unitPriceLabel: "$35.00",
      },
      {
        label: "BBQ-only kids",
        quantity: childAttendeeCount,
        unitPriceLabel: "$15.00",
      },
    ].filter((item) => item.quantity > 0),
  }),
}));

vi.mock("@/lib/rsvpCheckout", () => ({
  rsvpCheckoutPayloadSchema: {
    safeParse: (value: unknown) => ({ success: true, data: value }),
  },
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

describe("RsvpThanksPage", () => {
  it("renders a confirmed BBQ RSVP summary when the RSVP exists", async () => {
    rsvpCheckoutFindUnique.mockResolvedValue(null);
    rsvpFindUnique.mockResolvedValue({
      id: "rsvp-123",
      adultAttendeeCount: 2,
      childAttendeeCount: 1,
      attendeeCount: 3,
    });

    const html = renderToStaticMarkup(
      await RsvpThanksPage({
        searchParams: Promise.resolve({
          payment: "confirmed",
          rsvp: "rsvp-123",
        }),
      }),
    );

    expect(html).toContain("BBQ RSVP confirmed.");
    expect(html).toContain(
      "Your BBQ RSVP and payment were received successfully.",
    );
    expect(html).toContain("Amount paid");
    expect(html).toContain("Party size");
  });

  it("renders the confirmation poller while Square confirmation is still processing", async () => {
    rsvpCheckoutFindUnique.mockResolvedValue({
      payload: {
        adultAttendeeCount: 1,
        childAttendeeCount: 0,
        dietaryNotes: "None",
        email: "pat@example.com",
        familyNames: "Pat and family",
        firstName: "Pat",
        lastName: "Golfer",
        notes: "Looking forward to it",
      },
      rsvpId: null,
      status: "PENDING",
    });
    rsvpFindUnique.mockResolvedValue(null);

    const html = renderToStaticMarkup(
      await RsvpThanksPage({
        searchParams: Promise.resolve({
          payment: "processing",
          rsvpCheckout: "rsvp-checkout-123",
        }),
      }),
    );

    expect(html).toContain("Confirming payment.");
    expect(html).toContain("poller:/api/rsvp/checkout/rsvp-checkout-123");
    expect(html).not.toContain("Return to existing checkout");
  });

  it("renders a retry checkout action only when the payment state is explicitly retryable", async () => {
    rsvpCheckoutFindUnique.mockResolvedValue({
      payload: {
        adultAttendeeCount: 1,
        childAttendeeCount: 0,
        dietaryNotes: "None",
        email: "pat@example.com",
        familyNames: "Pat and family",
        firstName: "Pat",
        lastName: "Golfer",
        notes: "Looking forward to it",
      },
      rsvpId: null,
      status: "PENDING",
    });
    rsvpFindUnique.mockResolvedValue(null);

    const html = renderToStaticMarkup(
      await RsvpThanksPage({
        searchParams: Promise.resolve({
          payment: "retry",
          rsvpCheckout: "rsvp-checkout-123",
        }),
      }),
    );

    expect(html).toContain("Payment not finished yet.");
    expect(html).toContain("Return to existing checkout");
  });

  it("keeps polling when BBQ RSVP payment verification is temporarily unavailable", async () => {
    rsvpCheckoutFindUnique.mockResolvedValue({
      payload: {
        adultAttendeeCount: 1,
        childAttendeeCount: 0,
        dietaryNotes: "None",
        email: "pat@example.com",
        familyNames: "Pat and family",
        firstName: "Pat",
        lastName: "Golfer",
        notes: "Looking forward to it",
      },
      rsvpId: null,
      status: "PENDING",
    });
    rsvpFindUnique.mockResolvedValue(null);

    const html = renderToStaticMarkup(
      await RsvpThanksPage({
        searchParams: Promise.resolve({
          payment: "unavailable",
          rsvpCheckout: "rsvp-checkout-123",
        }),
      }),
    );

    expect(html).toContain("We can&#x27;t verify this payment yet.");
    expect(html).toContain("poller:/api/rsvp/checkout/rsvp-checkout-123");
    expect(html).not.toContain("Return to existing checkout");
  });
});
