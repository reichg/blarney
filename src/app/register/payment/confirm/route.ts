import { verifyRegistrationPaymentConfirmationToken } from "@/lib/payment";
import { confirmRegistrationCheckoutPayment } from "@/lib/registrationCheckout";
import { NextResponse } from "next/server";
import { z } from "zod";

const paymentConfirmationSchema = z.object({
  checkout: z.string().trim().min(1),
  token: z.string().trim().min(1),
});

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

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const rawCheckout = requestUrl.searchParams.get("checkout") ?? undefined;
  const parsed = paymentConfirmationSchema.safeParse({
    checkout: rawCheckout,
    token: requestUrl.searchParams.get("token"),
  });

  if (!parsed.success) {
    return NextResponse.redirect(
      buildThanksUrl(request, { checkoutId: rawCheckout, payment: "invalid" }),
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
