import { submitRegistration } from "@/app/actions/registration";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createRegistrationCheckoutPayment, registrationPayloadParse } =
  vi.hoisted(() => ({
    createRegistrationCheckoutPayment: vi.fn(),
    registrationPayloadParse: vi.fn((value: unknown) => value),
  }));

vi.mock("@/lib/registrationCheckout", () => ({
  createRegistrationCheckoutPayment,
  registrationCheckoutPayloadSchema: {
    parse: registrationPayloadParse,
  },
}));

function buildFormData(overrides: Record<string, string | undefined> = {}) {
  const formData = new FormData();
  const values = {
    firstName: "Morgan",
    lastName: "Payer",
    email: "Morgan@example.com",
    phone: "555-0100",
    packageSelection: "GOLF",
    golfers: JSON.stringify([
      {
        firstName: "Pat",
        lastName: "Golfer",
        gender: "FEMALE",
        age: 42,
        averageScore: 39,
      },
      {
        firstName: "Riley",
        lastName: "Golfer",
        gender: "MALE",
        age: 14,
        averageScore: 48,
      },
    ]),
    bbqOnlyAdultCount: "2",
    bbqOnlyKidCount: "1",
    notes: "Seat us with the early group",
    dietaryNotes: "Vegetarian dinner",
    ...overrides,
  };

  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) {
      formData.set(key, value);
    }
  }

  return formData;
}

beforeEach(() => {
  createRegistrationCheckoutPayment.mockResolvedValue({
    ok: true,
    status: "pending",
    checkoutId: "checkout-1",
    paymentReference: "payment-link-1",
    paymentUrl: "https://square.link/u/checkout-1",
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("submitRegistration", () => {
  it("creates a checkout payment from contact, golfers, and BBQ-only counts", async () => {
    await expect(submitRegistration(buildFormData())).resolves.toEqual({
      ok: true,
      checkoutId: "checkout-1",
      checkoutUrl: "https://square.link/u/checkout-1",
      paymentUrl: "https://square.link/u/checkout-1",
      paymentPath: "/register/payment?checkout=checkout-1",
      thanksPath: "/register/thanks?checkout=checkout-1",
    });

    expect(registrationPayloadParse).toHaveBeenCalledWith({
      firstName: "Morgan",
      lastName: "Payer",
      email: "morgan@example.com",
      phone: "555-0100",
      packageSelection: "GOLF",
      golfers: [
        {
          firstName: "Pat",
          lastName: "Golfer",
          gender: "FEMALE",
          age: 42,
          averageScore: 39,
        },
        {
          firstName: "Riley",
          lastName: "Golfer",
          gender: "MALE",
          age: 14,
          averageScore: 48,
        },
      ],
      bbqOnlyAdultCount: 2,
      bbqOnlyKidCount: 1,
      notes: "Seat us with the early group",
      dietaryNotes: "Vegetarian dinner",
    });
    expect(createRegistrationCheckoutPayment).toHaveBeenCalledWith(
      registrationPayloadParse.mock.results[0].value,
    );
  });

  it("keeps a compatibility path for the current single-golfer form fields", async () => {
    const formData = buildFormData({
      golfers: undefined,
      firstName: "Pat",
      lastName: "Golfer",
      email: "Pat@example.com",
      gender: "FEMALE",
      age: "42",
      averageScore: "39",
      bbqOnlyAdultCount: undefined,
      bbqOnlyKidCount: undefined,
      adultGuestCount: "1",
      childGuestCount: "2",
    });

    await expect(submitRegistration(formData)).resolves.toMatchObject({
      ok: true,
      checkoutId: "checkout-1",
    });

    expect(registrationPayloadParse).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: "Pat",
        lastName: "Golfer",
        email: "pat@example.com",
        golfers: [
          {
            firstName: "Pat",
            lastName: "Golfer",
            gender: "FEMALE",
            age: 42,
            averageScore: 39,
          },
        ],
        bbqOnlyAdultCount: 1,
        bbqOnlyKidCount: 2,
      }),
    );
  });

  it("returns duplicate copy when checkout creation detects an existing payer email", async () => {
    createRegistrationCheckoutPayment.mockResolvedValue({
      ok: false,
      reason: "duplicate",
    });

    await expect(submitRegistration(buildFormData())).resolves.toEqual({
      ok: false,
      error: "This email already has a registration or RSVP on file.",
    });
  });

  it("returns a validation error before starting checkout for invalid golfer data", async () => {
    await expect(
      submitRegistration(buildFormData({ golfers: "not-json" })),
    ).resolves.toEqual({
      ok: false,
      error: "Complete the required registration details and try again.",
    });

    expect(registrationPayloadParse).not.toHaveBeenCalled();
    expect(createRegistrationCheckoutPayment).not.toHaveBeenCalled();
  });
});
