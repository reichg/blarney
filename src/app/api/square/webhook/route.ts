import { isSquareOrderPaid } from "@/lib/payment";
import { confirmRegistrationCheckoutPaymentByOrderId } from "@/lib/registrationCheckout";
import { confirmRsvpCheckoutPaymentByOrderId } from "@/lib/rsvpCheckout";
import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const squareSignatureHeader = "x-square-hmacsha256-signature";
const supportedSquareEventTypes = new Set([
  "payment.created",
  "payment.updated",
  "order.updated",
]);

const squareWebhookSchema = z
  .object({
    type: z.string().trim().min(1),
    data: z
      .object({
        object: z
          .object({
            payment: z
              .object({
                id: z.string().optional(),
                order_id: z.string().optional(),
                status: z.string().optional(),
              })
              .passthrough()
              .optional(),
            order: z
              .object({
                id: z.string().optional(),
                state: z.string().optional(),
                tenders: z
                  .array(
                    z
                      .object({
                        id: z.string().optional(),
                        payment_id: z.string().optional(),
                      })
                      .passthrough(),
                  )
                  .optional(),
                net_amount_due_money: z
                  .object({
                    amount: z.number().optional(),
                    currency: z.string().optional(),
                  })
                  .passthrough()
                  .optional(),
              })
              .passthrough()
              .optional(),
          })
          .passthrough()
          .optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

function getSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001").replace(
    /\/$/,
    "",
  );
}

function getSquareWebhookNotificationUrl() {
  const configuredUrl = process.env.SQUARE_WEBHOOK_NOTIFICATION_URL?.trim();

  if (configuredUrl) {
    return configuredUrl;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("SQUARE_WEBHOOK_NOTIFICATION_URL must be configured.");
  }

  return `${getSiteUrl()}/api/square/webhook`;
}

function getSquareWebhookSignatureKey() {
  const signatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY?.trim();

  if (!signatureKey) {
    throw new Error("SQUARE_WEBHOOK_SIGNATURE_KEY must be configured.");
  }

  return signatureKey;
}

function verifySquareWebhookSignature({
  rawBody,
  signature,
}: {
  rawBody: string;
  signature: string | null;
}) {
  if (!signature) {
    return false;
  }

  const expectedSignature = createHmac("sha256", getSquareWebhookSignatureKey())
    .update(`${getSquareWebhookNotificationUrl()}${rawBody}`)
    .digest("base64");
  const expected = Buffer.from(expectedSignature, "utf8");
  const received = Buffer.from(signature.trim(), "utf8");

  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}

function getCompletedPaymentOrderId(payload: unknown) {
  const parsed = squareWebhookSchema.safeParse(payload);

  if (!parsed.success) {
    return { ok: false, reason: "invalid_payload" } as const;
  }

  if (!supportedSquareEventTypes.has(parsed.data.type)) {
    return { ok: false, reason: "ignored" } as const;
  }

  if (parsed.data.type === "order.updated") {
    const order = parsed.data.data?.object?.order;
    const orderId = order?.id?.trim();

    if (!orderId || !isSquareOrderPaid(order)) {
      return { ok: false, reason: "ignored" } as const;
    }

    return { ok: true, orderId } as const;
  }

  const payment = parsed.data.data?.object?.payment;
  const orderId = payment?.order_id?.trim();

  if (payment?.status?.toUpperCase() !== "COMPLETED" || !orderId) {
    return { ok: false, reason: "ignored" } as const;
  }

  return { ok: true, orderId } as const;
}

async function confirmPublicCheckoutPaymentByOrderId(orderId: string) {
  const registrationConfirmation =
    await confirmRegistrationCheckoutPaymentByOrderId(orderId);

  if (registrationConfirmation.ok) {
    return {
      ok: true as const,
      kind: "registration" as const,
      registrationId: registrationConfirmation.registrationId,
    };
  }

  if (registrationConfirmation.reason !== "invalid") {
    return registrationConfirmation;
  }

  const rsvpConfirmation = await confirmRsvpCheckoutPaymentByOrderId(orderId);

  if (rsvpConfirmation.ok) {
    return {
      ok: true as const,
      kind: "rsvp" as const,
      rsvpId: rsvpConfirmation.rsvpId,
    };
  }

  return rsvpConfirmation;
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  try {
    const isVerified = verifySquareWebhookSignature({
      rawBody,
      signature: request.headers.get(squareSignatureHeader),
    });

    if (!isVerified) {
      return NextResponse.json(
        { ok: false, status: "invalid_signature" },
        { status: 401 },
      );
    }
  } catch (error) {
    console.error("Square webhook signature verification failed", error);

    return NextResponse.json(
      { ok: false, status: "verification_unavailable" },
      { status: 500 },
    );
  }

  let payload: unknown;

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { ok: false, status: "invalid_payload" },
      { status: 400 },
    );
  }

  const completedPayment = getCompletedPaymentOrderId(payload);

  if (!completedPayment.ok) {
    return NextResponse.json({ ok: true, status: completedPayment.reason });
  }

  const confirmation = await confirmPublicCheckoutPaymentByOrderId(
    completedPayment.orderId,
  );

  if (confirmation.ok) {
    if (confirmation.kind === "rsvp") {
      return NextResponse.json({
        ok: true,
        status: "confirmed",
        rsvpId: confirmation.rsvpId,
      });
    }

    return NextResponse.json({
      ok: true,
      status: "confirmed",
      registrationId: confirmation.registrationId,
    });
  }

  if (confirmation.reason === "invalid") {
    return NextResponse.json({ ok: true, status: "ignored" });
  }

  if (confirmation.reason === "review") {
    return NextResponse.json({ ok: true, status: "review" });
  }

  return NextResponse.json(
    { ok: false, status: confirmation.reason },
    { status: 500 },
  );
}
