import {
  verifyRegistrationPaymentConfirmationToken,
  verifyRsvpPaymentConfirmationToken,
} from "@/lib/payment";
import { confirmRegistrationCheckoutPayment } from "@/lib/registrationCheckout";
import { confirmRsvpCheckoutPayment } from "@/lib/rsvpCheckout";
import { NextResponse } from "next/server";
import { z } from "zod";

const paymentConfirmationSchema = z
  .object({
    checkout: z.string().trim().min(1).optional(),
    rsvpCheckout: z.string().trim().min(1).optional(),
    token: z.string().trim().min(1),
  })
  .refine((data) => Boolean(data.checkout) !== Boolean(data.rsvpCheckout));

function buildThanksUrl(
  request: Request,
  options: {
    checkoutId?: string;
    payment?: string;
    registrationId?: string;
  } = {},
) {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const thanksUrl = new URL(
    "/register/thanks",
    configuredSiteUrl || request.url,
  );

  if (options.checkoutId) {
    thanksUrl.searchParams.set("checkout", options.checkoutId);
  }

  if (options.registrationId) {
    thanksUrl.searchParams.set("registration", options.registrationId);
  }

  if (options.payment) {
    thanksUrl.searchParams.set("payment", options.payment);
  }

  return thanksUrl;
}

function buildRsvpThanksUrl(
  request: Request,
  options: {
    payment?: string;
    rsvpCheckoutId?: string;
    rsvpId?: string;
  } = {},
) {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const thanksUrl = new URL("/register/thanks", configuredSiteUrl || request.url);

  if (options.rsvpCheckoutId) {
    thanksUrl.searchParams.set("rsvpCheckout", options.rsvpCheckoutId);
  }

  if (options.rsvpId) {
    thanksUrl.searchParams.set("rsvp", options.rsvpId);
  }

  if (options.payment) {
    thanksUrl.searchParams.set("payment", options.payment);
  }

  return thanksUrl;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const rawCheckout = requestUrl.searchParams.get("checkout") ?? undefined;
  const rawRsvpCheckout =
    requestUrl.searchParams.get("rsvpCheckout") ?? undefined;
  const parsed = paymentConfirmationSchema.safeParse({
    checkout: rawCheckout,
    rsvpCheckout: rawRsvpCheckout,
    token: requestUrl.searchParams.get("token"),
  });

  if (!parsed.success) {
    if (rawRsvpCheckout) {
      return NextResponse.redirect(
        buildRsvpThanksUrl(request, {
          rsvpCheckoutId: rawRsvpCheckout,
          payment: "invalid",
        }),
      );
    }

    return NextResponse.redirect(
      buildThanksUrl(request, { checkoutId: rawCheckout, payment: "invalid" }),
    );
  }

  if (parsed.data.rsvpCheckout) {
    const confirmation = await verifyRsvpPaymentConfirmationToken(
      parsed.data.token,
    );

    if (!confirmation || confirmation.checkoutId !== parsed.data.rsvpCheckout) {
      return NextResponse.redirect(
        buildRsvpThanksUrl(request, {
          rsvpCheckoutId: parsed.data.rsvpCheckout,
          payment: "invalid",
        }),
      );
    }

    const checkoutConfirmation = await confirmRsvpCheckoutPayment(
      parsed.data.rsvpCheckout,
    );

    if (checkoutConfirmation.ok) {
      return NextResponse.redirect(
        buildRsvpThanksUrl(request, {
          payment: "confirmed",
          rsvpId: checkoutConfirmation.rsvpId,
        }),
      );
    }

    return NextResponse.redirect(
      buildRsvpThanksUrl(request, {
        rsvpCheckoutId: parsed.data.rsvpCheckout,
        payment:
          checkoutConfirmation.reason === "pending" ||
          checkoutConfirmation.reason === "unavailable"
            ? "processing"
            : checkoutConfirmation.reason,
      }),
    );
  }

  const confirmation = await verifyRegistrationPaymentConfirmationToken(
    parsed.data.token,
  );

  if (!confirmation || confirmation.checkoutId !== parsed.data.checkout) {
    return NextResponse.redirect(
      buildThanksUrl(request, {
        checkoutId: parsed.data.checkout,
        payment: "invalid",
      }),
    );
  }

  const checkoutConfirmation = await confirmRegistrationCheckoutPayment(
    parsed.data.checkout,
  );

  if (checkoutConfirmation.ok) {
    return NextResponse.redirect(
      buildThanksUrl(request, {
        payment: "confirmed",
        registrationId: checkoutConfirmation.registrationId,
      }),
    );
  }

  return NextResponse.redirect(
    buildThanksUrl(request, {
      checkoutId: parsed.data.checkout,
      payment:
        checkoutConfirmation.reason === "pending" ||
        checkoutConfirmation.reason === "unavailable"
          ? "processing"
          : checkoutConfirmation.reason,
    }),
  );
}
