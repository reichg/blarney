import { getMarketplaceCheckoutPayment } from "@/lib/marketplaceCheckout";
import { isTrustedSquareCheckoutUrl } from "@/lib/squareCheckoutUrl";
import { NextResponse } from "next/server";
import { checkoutStatusSchema, type CheckoutStatusRouteContext } from "./type";

export const dynamic = "force-dynamic";

function jsonNoStore(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...init?.headers,
    },
  });
}

export async function GET(
  _request: Request,
  { params }: CheckoutStatusRouteContext,
) {
  const parsed = checkoutStatusSchema.safeParse(await params);

  if (!parsed.success) {
    return jsonNoStore({ ok: false, status: "invalid" }, { status: 400 });
  }

  const checkoutPayment = await getMarketplaceCheckoutPayment(
    parsed.data.checkoutId,
  );

  if (checkoutPayment.ok) {
    if (checkoutPayment.status === "confirmed") {
      return jsonNoStore({
        ok: true,
        status: "confirmed",
        orderId: checkoutPayment.orderId,
      });
    }

    if (!isTrustedSquareCheckoutUrl(checkoutPayment.paymentUrl)) {
      return jsonNoStore({ ok: true, status: "unavailable" });
    }

    return jsonNoStore({
      ok: true,
      status: "pending",
      paymentUrl: checkoutPayment.paymentUrl,
    });
  }

  if (checkoutPayment.reason === "not_found") {
    return jsonNoStore({ ok: false, status: "not_found" }, { status: 404 });
  }

  if (checkoutPayment.reason === "expired") {
    return jsonNoStore({ ok: true, status: "expired" });
  }

  if (checkoutPayment.reason === "review") {
    return jsonNoStore({ ok: true, status: "review" });
  }

  return jsonNoStore({ ok: true, status: "unavailable" });
}
