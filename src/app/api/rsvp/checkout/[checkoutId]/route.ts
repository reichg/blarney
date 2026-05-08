import { db } from "@/lib/db";
import { getRsvpCheckoutPaymentPath } from "@/lib/payment";
import { confirmRsvpCheckoutPayment } from "@/lib/rsvpCheckout";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const checkoutStatusSchema = z.object({
  checkoutId: z.string().trim().min(1),
});

type CheckoutStatusRouteContext = {
  params: Promise<{
    checkoutId: string;
  }>;
};

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

  const checkout = await db.rsvpCheckout.findUnique({
    where: { id: parsed.data.checkoutId },
    select: {
      id: true,
      rsvpId: true,
      status: true,
    },
  });

  if (!checkout) {
    return jsonNoStore({ ok: false, status: "not_found" }, { status: 404 });
  }

  if (checkout.status === "CONFIRMED" && checkout.rsvpId) {
    return jsonNoStore({
      ok: true,
      status: "confirmed",
      rsvpId: checkout.rsvpId,
      thanksPath: `/rsvp/thanks?rsvp=${encodeURIComponent(
        checkout.rsvpId,
      )}&payment=confirmed`,
    });
  }

  const checkoutConfirmation = await confirmRsvpCheckoutPayment(checkout.id);

  if (checkoutConfirmation.ok) {
    return jsonNoStore({
      ok: true,
      status: "confirmed",
      rsvpId: checkoutConfirmation.rsvpId,
      thanksPath: `/rsvp/thanks?rsvp=${encodeURIComponent(
        checkoutConfirmation.rsvpId,
      )}&payment=confirmed`,
    });
  }

  if (checkoutConfirmation.reason === "invalid") {
    return jsonNoStore({ ok: false, status: "invalid" }, { status: 400 });
  }

  if (checkoutConfirmation.reason === "review") {
    return jsonNoStore({ ok: true, status: "review" });
  }

  if (checkoutConfirmation.reason === "retry") {
    return jsonNoStore({
      ok: true,
      status: "retry",
      paymentPath: getRsvpCheckoutPaymentPath(checkout.id),
    });
  }

  if (checkoutConfirmation.reason === "unavailable") {
    return jsonNoStore({ ok: true, status: "unavailable" });
  }

  return jsonNoStore({
    ok: true,
    status: "processing",
    paymentPath: getRsvpCheckoutPaymentPath(checkout.id),
  });
}
