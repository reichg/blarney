import { afterEach, describe, expect, it, vi } from "vitest";

const { getRegistrationCheckoutPayment, getRsvpCheckoutPayment } = vi.hoisted(
  () => ({
    getRegistrationCheckoutPayment: vi.fn(),
    getRsvpCheckoutPayment: vi.fn(),
  }),
);

vi.mock("@/lib/registrationCheckout", () => ({
  getRegistrationCheckoutPayment,
}));

vi.mock("@/lib/rsvpCheckout", () => ({
  getRsvpCheckoutPayment,
}));

import { GET } from "@/app/register/payment/route";

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

const publicSiteUrl = "https://blarney42.gabe-reichenberger.com";

describe("registration payment route", () => {
  it("redirects a checkout to its existing Square payment URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", publicSiteUrl);
    getRegistrationCheckoutPayment.mockResolvedValue({
      ok: true,
      status: "pending",
      checkoutId: "checkout-123",
      paymentReference: "payment-link-1",
      paymentUrl: "https://square.link/u/existing",
    });

    const response = await GET(
      new Request(
        "http://localhost:3000/register/payment?checkout=checkout-123",
      ),
    );

    expect(getRegistrationCheckoutPayment).toHaveBeenCalledWith("checkout-123");
    expect(response.headers.get("location")).toBe(
      "https://square.link/u/existing",
    );
  });

  it("redirects to thanks when the checkout is already confirmed", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", publicSiteUrl);
    getRegistrationCheckoutPayment.mockResolvedValue({
      ok: true,
      status: "confirmed",
      checkoutId: "checkout-123",
      registrationId: "registration-123",
      paymentUrl: null,
    });

    const response = await GET(
      new Request(
        "http://localhost:3000/register/payment?checkout=checkout-123",
      ),
    );

    expect(response.headers.get("location")).toBe(
      `${publicSiteUrl}/register/thanks?registration=registration-123&payment=confirmed`,
    );
  });

  it("does not create a new payment path for legacy registration id URLs", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", publicSiteUrl);
    const response = await GET(
      new Request(
        "http://localhost:3000/register/payment?registration=registration-123",
      ),
    );

    expect(getRegistrationCheckoutPayment).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(
      `${publicSiteUrl}/register/thanks?registration=registration-123&payment=invalid`,
    );
  });

  it("redirects unavailable checkouts back to thanks without a charge link", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", publicSiteUrl);
    getRegistrationCheckoutPayment.mockResolvedValue({
      ok: false,
      reason: "configuration",
    });

    const response = await GET(
      new Request(
        "http://localhost:3000/register/payment?checkout=checkout-123",
      ),
    );

    expect(response.headers.get("location")).toBe(
      `${publicSiteUrl}/register/thanks?checkout=checkout-123&payment=configuration`,
    );
  });

  it("redirects paid checkouts that need review back to a review status", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", publicSiteUrl);
    getRegistrationCheckoutPayment.mockResolvedValue({
      ok: false,
      reason: "review",
    });

    const response = await GET(
      new Request(
        "http://localhost:3000/register/payment?checkout=checkout-123",
      ),
    );

    expect(response.headers.get("location")).toBe(
      `${publicSiteUrl}/register/thanks?checkout=checkout-123&payment=review`,
    );
  });

  it("redirects an RSVP checkout to its Square payment URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", publicSiteUrl);
    getRsvpCheckoutPayment.mockResolvedValue({
      ok: true,
      status: "pending",
      checkoutId: "rsvp-checkout-123",
      paymentReference: "payment-link-1",
      paymentUrl: "https://square.link/u/rsvp-existing",
    });

    const response = await GET(
      new Request(
        "http://localhost:3000/register/payment?rsvpCheckout=rsvp-checkout-123",
      ),
    );

    expect(getRsvpCheckoutPayment).toHaveBeenCalledWith("rsvp-checkout-123");
    expect(response.headers.get("location")).toBe(
      "https://square.link/u/rsvp-existing",
    );
  });

  it("redirects confirmed RSVP checkouts to RSVP thanks", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", publicSiteUrl);
    getRsvpCheckoutPayment.mockResolvedValue({
      ok: true,
      status: "confirmed",
      checkoutId: "rsvp-checkout-123",
      rsvpId: "rsvp-123",
      paymentUrl: null,
    });

    const response = await GET(
      new Request(
        "http://localhost:3000/register/payment?rsvpCheckout=rsvp-checkout-123",
      ),
    );

    expect(response.headers.get("location")).toBe(
      `${publicSiteUrl}/rsvp/thanks?rsvp=rsvp-123&payment=confirmed`,
    );
  });
});
