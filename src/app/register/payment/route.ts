import { getRegistrationCheckoutPayment } from "@/lib/registrationCheckout";
import { NextResponse } from "next/server";
import { z } from "zod";

const paymentRequestSchema = z.object({
  checkout: z.string().trim().min(1).optional(),
  registration: z.string().trim().min(1).optional(),
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
  const parsed = paymentRequestSchema.safeParse({
    checkout: requestUrl.searchParams.get("checkout") ?? undefined,
    registration: requestUrl.searchParams.get("registration") ?? undefined,
  });

  if (!parsed.success || (!parsed.data.checkout && !parsed.data.registration)) {
    return NextResponse.redirect(buildThanksUrl(request));
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
