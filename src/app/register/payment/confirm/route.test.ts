import {
  createRegistrationPaymentConfirmationToken,
  createRsvpPaymentConfirmationToken,
} from "@/lib/payment";
import { afterEach, describe, expect, it, vi } from "vitest";

const { confirmRegistrationCheckoutPayment, confirmRsvpCheckoutPayment } =
  vi.hoisted(() => ({
    confirmRegistrationCheckoutPayment: vi.fn(),
    confirmRsvpCheckoutPayment: vi.fn(),
  }));

vi.mock("@/lib/registrationCheckout", () => ({
  confirmRegistrationCheckoutPayment,
}));

vi.mock("@/lib/rsvpCheckout", () => ({
  confirmRsvpCheckoutPayment,
}));

import { GET } from "@/app/register/payment/confirm/route";

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

const publicSiteUrl = "https://blarney42.gabe-reichenberger.com";

describe("registration payment confirmation route", () => {
  it("finalizes a checkout when the signed token matches", async () => {
    vi.stubEnv("ADMIN_SESSION_SECRET", "payment-confirmation-secret");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", publicSiteUrl);
    confirmRegistrationCheckoutPayment.mockResolvedValue({
      ok: true,
      registrationId: "registration-123",
    });

    const token =
      await createRegistrationPaymentConfirmationToken("checkout-123");
    const response = await GET(
      new Request(
        `http://localhost:3000/register/payment/confirm?checkout=checkout-123&token=${encodeURIComponent(token)}`,
      ),
    );

    expect(confirmRegistrationCheckoutPayment).toHaveBeenCalledWith(
      "checkout-123",
    );
    expect(response.headers.get("location")).toBe(
      `${publicSiteUrl}/register/thanks?registration=registration-123&payment=confirmed`,
    );
  });

  it("leaves the checkout pending when the token is invalid", async () => {
    vi.stubEnv("ADMIN_SESSION_SECRET", "payment-confirmation-secret");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", publicSiteUrl);

    const response = await GET(
      new Request(
        "http://localhost:3000/register/payment/confirm?checkout=checkout-123&token=invalid",
      ),
    );

    expect(confirmRegistrationCheckoutPayment).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(
      `${publicSiteUrl}/register/thanks?checkout=checkout-123&payment=invalid`,
    );
  });

  it("shows chair review when a paid checkout cannot be finalized automatically", async () => {
    vi.stubEnv("ADMIN_SESSION_SECRET", "payment-confirmation-secret");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", publicSiteUrl);
    confirmRegistrationCheckoutPayment.mockResolvedValue({
      ok: false,
      reason: "review",
      paymentUrl: null,
    });

    const token =
      await createRegistrationPaymentConfirmationToken("checkout-123");
    const response = await GET(
      new Request(
        `http://localhost:3000/register/payment/confirm?checkout=checkout-123&token=${encodeURIComponent(token)}`,
      ),
    );

    expect(response.headers.get("location")).toBe(
      `${publicSiteUrl}/register/thanks?checkout=checkout-123&payment=review`,
    );
  });

  it("is idempotent when the checkout is already confirmed", async () => {
    vi.stubEnv("ADMIN_SESSION_SECRET", "payment-confirmation-secret");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", publicSiteUrl);
    confirmRegistrationCheckoutPayment.mockResolvedValue({
      ok: true,
      registrationId: "registration-123",
    });

    const token =
      await createRegistrationPaymentConfirmationToken("checkout-123");
    const response = await GET(
      new Request(
        `http://localhost:3000/register/payment/confirm?checkout=checkout-123&token=${encodeURIComponent(token)}`,
      ),
    );

    expect(confirmRegistrationCheckoutPayment).toHaveBeenCalledTimes(1);
    expect(response.headers.get("location")).toBe(
      `${publicSiteUrl}/register/thanks?registration=registration-123&payment=confirmed`,
    );
  });

  it("shows webhook processing when Square reconciliation says payment is pending", async () => {
    vi.stubEnv("ADMIN_SESSION_SECRET", "payment-confirmation-secret");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", publicSiteUrl);
    confirmRegistrationCheckoutPayment.mockResolvedValue({
      ok: false,
      reason: "pending",
      paymentUrl: "https://square.link/u/existing",
    });

    const token =
      await createRegistrationPaymentConfirmationToken("checkout-123");
    const response = await GET(
      new Request(
        `http://localhost:3000/register/payment/confirm?checkout=checkout-123&token=${encodeURIComponent(token)}`,
      ),
    );

    expect(response.headers.get("location")).toBe(
      `${publicSiteUrl}/register/thanks?checkout=checkout-123&payment=processing`,
    );
  });

  it("preserves unavailable when redirect reconciliation cannot reach Square", async () => {
    vi.stubEnv("ADMIN_SESSION_SECRET", "payment-confirmation-secret");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", publicSiteUrl);
    confirmRegistrationCheckoutPayment.mockResolvedValue({
      ok: false,
      reason: "unavailable",
      paymentUrl: "https://square.link/u/existing",
    });

    const token =
      await createRegistrationPaymentConfirmationToken("checkout-123");
    const response = await GET(
      new Request(
        `http://localhost:3000/register/payment/confirm?checkout=checkout-123&token=${encodeURIComponent(token)}`,
      ),
    );

    expect(response.headers.get("location")).toBe(
      `${publicSiteUrl}/register/thanks?checkout=checkout-123&payment=unavailable`,
    );
  });

  it("finalizes an RSVP checkout when the signed token matches", async () => {
    vi.stubEnv("ADMIN_SESSION_SECRET", "payment-confirmation-secret");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", publicSiteUrl);
    confirmRsvpCheckoutPayment.mockResolvedValue({
      ok: true,
      rsvpId: "rsvp-123",
    });

    const token = await createRsvpPaymentConfirmationToken("rsvp-checkout-123");
    const response = await GET(
      new Request(
        `http://localhost:3000/register/payment/confirm?rsvpCheckout=rsvp-checkout-123&token=${encodeURIComponent(token)}`,
      ),
    );

    expect(confirmRsvpCheckoutPayment).toHaveBeenCalledWith(
      "rsvp-checkout-123",
    );
    expect(response.headers.get("location")).toBe(
      `${publicSiteUrl}/rsvp/thanks?rsvp=rsvp-123&payment=confirmed`,
    );
  });

  it("leaves an RSVP checkout pending when the token is invalid", async () => {
    vi.stubEnv("ADMIN_SESSION_SECRET", "payment-confirmation-secret");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", publicSiteUrl);

    const response = await GET(
      new Request(
        "http://localhost:3000/register/payment/confirm?rsvpCheckout=rsvp-checkout-123&token=invalid",
      ),
    );

    expect(confirmRsvpCheckoutPayment).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(
      `${publicSiteUrl}/rsvp/thanks?rsvpCheckout=rsvp-checkout-123&payment=invalid`,
    );
  });
});
