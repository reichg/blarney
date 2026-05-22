import { RegistrationForm } from "@/app/register/RegistrationForm";
import type { RegistrationFormProps } from "@/app/register/type";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

function createStyleProxy() {
  return new Proxy(
    {},
    {
      get: (_, key) => String(key),
    },
  );
}

function createProps(): RegistrationFormProps {
  return {
    currency: "USD",
    defaultPackageSelection: "REGISTER_GOLF",
    golfPriceCents: 15000,
    golfPriceLabel: "$150.00",
    adultGuestPriceCents: 2500,
    adultGuestPriceLabel: "$25.00",
    childGuestPriceCents: 1200,
    childGuestPriceLabel: "$12.00",
    submitRegistrationAction: vi.fn(async () => ({
      ok: false,
      error: "unused",
    })),
    submitRsvpAction: vi.fn(async () => ({
      ok: false,
      reason: "invalid",
      error: "unused",
    })),
  };
}

vi.mock("@/app/forms.module.css", () => ({
  default: createStyleProxy(),
}));

vi.mock("lucide-react", () => ({
  CreditCard: () => createElement("svg", { "data-slot": "credit-card-icon" }),
  Flag: () => createElement("svg", { "data-slot": "flag-icon" }),
  Plus: () => createElement("svg", { "data-slot": "plus-icon" }),
  Trash2: () => createElement("svg", { "data-slot": "trash-icon" }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe("RegistrationForm", () => {
  it("renders clearer top-level sections while keeping the core golf registration controls", () => {
    const html = renderToStaticMarkup(
      createElement(RegistrationForm, createProps()),
    );

    expect(html).toContain(">Payer information</legend>");
    expect(html).toContain(">Attendee details</h2>");
    expect(html).toContain(">Notes</legend>");
    expect(html).toContain(">Payment</h2>");
    expect(html).toContain(">Payment summary</h3>");
    expect(html).toContain('name="firstName"');
    expect(html).toContain('name="email"');
    expect(html).toContain('name="golferFirstName"');
    expect(html).toContain('name="dietaryNotes"');
    expect(html).toContain('name="notes"');
    expect(html).toContain(">Continue to checkout<");
  });
});
