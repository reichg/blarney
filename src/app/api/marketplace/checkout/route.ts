import { createMarketplaceCheckoutPayment } from "@/lib/marketplaceCheckout";
import { marketplaceCheckoutRequestSchema } from "@/lib/marketplaceCheckout.schema";
import { isTrustedSquareCheckoutUrl } from "@/lib/squareCheckoutUrl";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const marketplaceCreateCheckoutRequestSchema = marketplaceCheckoutRequestSchema
  .pick({
    items: true,
    customer: true,
  })
  .strict();

function jsonNoStore(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...init?.headers,
    },
  });
}

async function parseRequestBody(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const body = await parseRequestBody(request);

  if (body === null) {
    return jsonNoStore({ ok: false, status: "invalid" }, { status: 400 });
  }

  const parsed = marketplaceCreateCheckoutRequestSchema.safeParse(body);

  if (!parsed.success) {
    return jsonNoStore({ ok: false, status: "invalid" }, { status: 400 });
  }

  const checkoutPayment = await createMarketplaceCheckoutPayment({
    items: parsed.data.items,
    customer: parsed.data.customer,
    requestSnapshot: {
      source: "marketplace-ui",
    },
  });

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
      checkoutId: checkoutPayment.checkoutId,
      paymentUrl: checkoutPayment.paymentUrl,
    });
  }

  if (checkoutPayment.reason === "unavailable_items") {
    return jsonNoStore(
      { ok: false, status: "unavailable_items" },
      { status: 409 },
    );
  }

  if (checkoutPayment.reason === "review") {
    return jsonNoStore({ ok: true, status: "review" });
  }

  return jsonNoStore({ ok: true, status: "unavailable" });
}
