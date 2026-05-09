import { getRegistrationCheckoutPayment } from "@/lib/registrationCheckout";
import { getRsvpCheckoutPayment } from "@/lib/rsvpCheckout";
import { NextResponse } from "next/server";
import { paymentRequestSchema } from "./type";

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
  const thanksUrl = new URL("/rsvp/thanks", configuredSiteUrl || request.url);

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
  const parsed = paymentRequestSchema.safeParse({
    checkout: requestUrl.searchParams.get("checkout") ?? undefined,
    registration: requestUrl.searchParams.get("registration") ?? undefined,
    rsvpCheckout: requestUrl.searchParams.get("rsvpCheckout") ?? undefined,
  });

  if (
    !parsed.success ||
    (!parsed.data.checkout &&
      !parsed.data.registration &&
      !parsed.data.rsvpCheckout)
  ) {
    return NextResponse.redirect(buildThanksUrl(request));
  }

  if (parsed.data.rsvpCheckout) {
    try {
      const checkoutPayment = await getRsvpCheckoutPayment(
        parsed.data.rsvpCheckout,
      );

      if (!checkoutPayment.ok) {
        return NextResponse.redirect(
          buildRsvpThanksUrl(request, {
            rsvpCheckoutId: parsed.data.rsvpCheckout,
            payment:
              checkoutPayment.reason === "configuration"
                ? "configuration"
                : checkoutPayment.reason === "review"
                  ? "review"
                  : checkoutPayment.reason === "not_found"
                    ? "invalid"
                    : "unavailable",
          }),
        );
      }

      if (checkoutPayment.status === "confirmed") {
        return NextResponse.redirect(
          buildRsvpThanksUrl(request, {
            payment: "confirmed",
            rsvpId: checkoutPayment.rsvpId,
          }),
        );
      }

      return NextResponse.redirect(checkoutPayment.paymentUrl);
    } catch {
      return NextResponse.redirect(
        buildRsvpThanksUrl(request, {
          rsvpCheckoutId: parsed.data.rsvpCheckout,
          payment: "unavailable",
        }),
      );
    }
  }

  if (parsed.data.registration && !parsed.data.checkout) {
    return NextResponse.redirect(
      buildThanksUrl(request, {
        payment: "invalid",
        registrationId: parsed.data.registration,
      }),
    );
  }

  if (!parsed.data.checkout) {
    return NextResponse.redirect(buildThanksUrl(request));
  }

  try {
    const checkoutPayment = await getRegistrationCheckoutPayment(
      parsed.data.checkout,
    );

    if (!checkoutPayment.ok) {
      return NextResponse.redirect(
        buildThanksUrl(request, {
          checkoutId: parsed.data.checkout,
          payment:
            checkoutPayment.reason === "configuration"
              ? "configuration"
              : checkoutPayment.reason === "review"
                ? "review"
                : checkoutPayment.reason === "not_found"
                  ? "invalid"
                  : "unavailable",
        }),
      );
    }

    if (checkoutPayment.status === "confirmed") {
      return NextResponse.redirect(
        buildThanksUrl(request, {
          payment: "confirmed",
          registrationId: checkoutPayment.registrationId,
        }),
      );
    }

    return NextResponse.redirect(checkoutPayment.paymentUrl);
  } catch {
    return NextResponse.redirect(
      buildThanksUrl(request, {
        checkoutId: parsed.data.checkout,
        payment: "unavailable",
      }),
    );
  }
}
