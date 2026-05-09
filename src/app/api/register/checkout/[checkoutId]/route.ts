import { db } from "@/lib/db";
import { getRegistrationCheckoutPaymentPath } from "@/lib/payment";
import { confirmRegistrationCheckoutPayment } from "@/lib/registrationCheckout";
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

  const checkout = await db.registrationCheckout.findUnique({
    where: { id: parsed.data.checkoutId },
    select: {
      id: true,
      registrationId: true,
      status: true,
    },
  });

  if (!checkout) {
    return jsonNoStore({ ok: false, status: "not_found" }, { status: 404 });
  }

  if (checkout.status === "CONFIRMED" && checkout.registrationId) {
    return jsonNoStore({
      ok: true,
      status: "confirmed",
      registrationId: checkout.registrationId,
      thanksPath: `/register/thanks?registration=${encodeURIComponent(
        checkout.registrationId,
      )}&payment=confirmed`,
    });
  }

  const checkoutConfirmation = await confirmRegistrationCheckoutPayment(
    checkout.id,
  );

  if (checkoutConfirmation.ok) {
    return jsonNoStore({
      ok: true,
      status: "confirmed",
      registrationId: checkoutConfirmation.registrationId,
      thanksPath: `/register/thanks?registration=${encodeURIComponent(
        checkoutConfirmation.registrationId,
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
      paymentPath: getRegistrationCheckoutPaymentPath(checkout.id),
    });
  }

  if (checkoutConfirmation.reason === "unavailable") {
    return jsonNoStore({ ok: true, status: "unavailable" });
  }

  return jsonNoStore({
    ok: true,
    status: "processing",
    paymentPath: getRegistrationCheckoutPaymentPath(checkout.id),
  });
}
