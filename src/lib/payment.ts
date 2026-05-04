import { formatCurrency } from "@/lib/format";
import { createHash } from "crypto";
import { jwtVerify, SignJWT } from "jose";

const squareVersion = "2026-03-18";
const paymentConfirmationPurpose = "registration-payment-confirmation";
const encoder = new TextEncoder();
const paymentConfirmationTokenLifetime = "2h";

export const completeRegistrationPaymentStatuses = [
  "CONFIRMED",
  "WAIVED",
] as const;

export function isCompleteRegistrationPaymentStatus(status: string) {
  return status === "CONFIRMED" || status === "WAIVED";
}

type SquarePaymentLinkResponse = {
  errors?: Array<{
    code?: string;
    detail?: string;
  }>;
  payment_link?: {
    id?: string;
    url?: string;
    order_id?: string;
  };
};

type SquareOrder = {
  id?: string;
  state?: string;
  tenders?: Array<{
    id?: string;
    payment_id?: string;
  }>;
  net_amount_due_money?: {
    amount?: number;
    currency?: string;
  };
};

type SquarePaymentLinkDetailsResponse = SquarePaymentLinkResponse & {
  payment_link?: {
    id?: string;
    url?: string;
    order_id?: string;
  };
  related_resources?: {
    orders?: SquareOrder[];
  };
};

type SquareOrderResponse = {
  errors?: Array<{
    code?: string;
    detail?: string;
  }>;
  order?: SquareOrder;
};

type SquareOrderLineItem = {
  name: string;
  quantity: string;
  base_price_money: {
    amount: number;
    currency: string;
  };
};

export type RegistrationGuestCounts = {
  adultGuestCount: number;
  childGuestCount: number;
};

export type RegistrationPaymentLineItem = {
  label: string;
  quantity: number;
  unitPriceCents: number;
  unitPriceLabel: string;
  totalCents: number;
  totalLabel: string;
};

export type RegistrationPaymentBreakdown = {
  currency: string;
  golfPriceCents: number;
  golfPriceLabel: string;
  adultGuestCount: number;
  adultGuestPriceCents: number;
  adultGuestPriceLabel: string;
  childGuestCount: number;
  childGuestPriceCents: number;
  childGuestPriceLabel: string;
  totalCents: number;
  totalLabel: string;
  lineItems: RegistrationPaymentLineItem[];
};

export type RegistrationPaymentLinkState = {
  reference: string;
  orderId: string | null;
  url: string | null;
  orderState: string | null;
  isComplete: boolean;
};

function parseIntegerEnv(
  variableName: string,
  rawValue: string,
  minimum: number,
) {
  if (!/^-?\d+$/.test(rawValue)) {
    throw new Error(`${variableName} must be an integer >= ${minimum}.`);
  }

  const value = Number.parseInt(rawValue, 10);

  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(`${variableName} must be an integer >= ${minimum}.`);
  }

  return value;
}

function parseMoneyCents(variableName: string, minimum: number): number {
  const rawValue = process.env[variableName]?.trim();

  if (!rawValue) {
    throw new Error(`${variableName} must be configured.`);
  }

  return parseIntegerEnv(variableName, rawValue, minimum);
}

function parseMoneyCentsFromNames(variableNames: string[], minimum: number) {
  for (const variableName of variableNames) {
    const rawValue = process.env[variableName]?.trim();

    if (!rawValue) {
      continue;
    }

    return parseIntegerEnv(variableName, rawValue, minimum);
  }

  throw new Error(`${variableNames[0]} must be configured.`);
}

function getRequiredEnv(variableName: string) {
  const rawValue = process.env[variableName]?.trim();

  if (!rawValue) {
    throw new Error(`${variableName} must be configured.`);
  }

  return rawValue;
}

function getSquareRequestHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "Square-Version": squareVersion,
  };
}

function getSquareErrorDetail(errors: SquarePaymentLinkResponse["errors"]) {
  return errors
    ?.map(({ code, detail: message }) =>
      [code, message].filter(Boolean).join(": "),
    )
    .join(" ");
}

async function readSquareResponse<T>(response: Response) {
  return (await response.json().catch(() => ({}))) as T;
}

export function hasSquarePaymentConfiguration() {
  if (
    !process.env.SQUARE_ACCESS_TOKEN?.trim() ||
    !process.env.SQUARE_LOCATION_ID?.trim()
  ) {
    return false;
  }

  try {
    getRegistrationPricing();
    return true;
  } catch {
    return false;
  }
}

function getSquareEnvironment() {
  const environment = (process.env.SQUARE_ENVIRONMENT ?? "sandbox")
    .trim()
    .toLowerCase();

  if (environment !== "sandbox" && environment !== "production") {
    throw new Error("SQUARE_ENVIRONMENT must be either sandbox or production.");
  }

  return environment;
}

function getSquareApiBaseUrl() {
  return getSquareEnvironment() === "production"
    ? "https://connect.squareup.com/v2"
    : "https://connect.squareupsandbox.com/v2";
}

function getSiteUrl() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (!siteUrl) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("NEXT_PUBLIC_SITE_URL must be configured.");
    }

    return "http://localhost:3000";
  }

  return siteUrl.replace(/\/$/, "");
}

function getPaymentConfirmationSecret() {
  const dedicatedSecret =
    process.env.SQUARE_PAYMENT_CONFIRMATION_SECRET?.trim();
  const secret =
    dedicatedSecret ??
    (process.env.NODE_ENV === "production"
      ? undefined
      : process.env.ADMIN_SESSION_SECRET?.trim());

  if (!secret) {
    throw new Error("SQUARE_PAYMENT_CONFIRMATION_SECRET must be configured.");
  }

  return encoder.encode(secret);
}

function getRegistrationPaymentLinkIdempotencyKey(checkoutId: string) {
  return createHash("sha256")
    .update(`registration-payment-link:${checkoutId}`)
    .digest("hex")
    .slice(0, 45);
}

function buildLineItem(
  label: string,
  quantity: number,
  unitPriceCents: number,
  currency: string,
): RegistrationPaymentLineItem {
  const totalCents = quantity * unitPriceCents;

  return {
    label,
    quantity,
    unitPriceCents,
    unitPriceLabel: formatCurrency(unitPriceCents, currency),
    totalCents,
    totalLabel: formatCurrency(totalCents, currency),
  };
}

function toSquareOrderLineItem(
  item: RegistrationPaymentLineItem,
  currency: string,
): SquareOrderLineItem {
  return {
    name: item.label,
    quantity: String(item.quantity),
    base_price_money: {
      amount: item.unitPriceCents,
      currency,
    },
  };
}

export function getRegistrationPricing() {
  return {
    currency: process.env.SQUARE_CURRENCY ?? "USD",
    golfPriceCents: parseMoneyCents("REGISTRATION_GOLF_PRICE_CENTS", 1),
    adultGuestPriceCents: parseMoneyCentsFromNames(
      [
        "REGISTRATION_PRE_EVENT_ADULT_PRICE_CENTS",
        "REGISTRATION_PRE_EVENT_GUEST_PRICE_CENTS",
      ],
      0,
    ),
    childGuestPriceCents: parseMoneyCents(
      "REGISTRATION_PRE_EVENT_CHILD_PRICE_CENTS",
      0,
    ),
  };
}

export function getRegistrationPaymentBreakdown(
  guestCounts: RegistrationGuestCounts,
): RegistrationPaymentBreakdown {
  if (
    !Number.isInteger(guestCounts.adultGuestCount) ||
    guestCounts.adultGuestCount < 0
  ) {
    throw new Error("adultGuestCount must be a non-negative integer.");
  }

  if (
    !Number.isInteger(guestCounts.childGuestCount) ||
    guestCounts.childGuestCount < 0
  ) {
    throw new Error("childGuestCount must be a non-negative integer.");
  }

  const pricing = getRegistrationPricing();
  const lineItems = [
    buildLineItem("Golf entry", 1, pricing.golfPriceCents, pricing.currency),
  ];

  if (guestCounts.adultGuestCount > 0) {
    lineItems.push(
      buildLineItem(
        "Pre-event adults",
        guestCounts.adultGuestCount,
        pricing.adultGuestPriceCents,
        pricing.currency,
      ),
    );
  }

  if (guestCounts.childGuestCount > 0) {
    lineItems.push(
      buildLineItem(
        "Pre-event children",
        guestCounts.childGuestCount,
        pricing.childGuestPriceCents,
        pricing.currency,
      ),
    );
  }

  const totalCents = lineItems.reduce((sum, item) => sum + item.totalCents, 0);

  return {
    ...pricing,
    adultGuestCount: guestCounts.adultGuestCount,
    childGuestCount: guestCounts.childGuestCount,
    golfPriceLabel: formatCurrency(pricing.golfPriceCents, pricing.currency),
    adultGuestPriceLabel: formatCurrency(
      pricing.adultGuestPriceCents,
      pricing.currency,
    ),
    childGuestPriceLabel: formatCurrency(
      pricing.childGuestPriceCents,
      pricing.currency,
    ),
    totalCents,
    totalLabel: formatCurrency(totalCents, pricing.currency),
    lineItems,
  };
}

export function getOptionalRegistrationPaymentBreakdown(
  guestCounts: RegistrationGuestCounts,
) {
  try {
    return getRegistrationPaymentBreakdown(guestCounts);
  } catch {
    return null;
  }
}

export function getRegistrationPaymentPath(registrationId: string) {
  return `/register/payment?registration=${encodeURIComponent(registrationId)}`;
}

export function getRegistrationCheckoutPaymentPath(checkoutId: string) {
  return `/register/payment?checkout=${encodeURIComponent(checkoutId)}`;
}

export function getRegistrationPaymentConfirmationPath(
  checkoutId: string,
  token: string,
) {
  return `/register/payment/confirm?checkout=${encodeURIComponent(checkoutId)}&token=${encodeURIComponent(token)}`;
}

export async function createRegistrationPaymentConfirmationToken(
  checkoutId: string,
) {
  return new SignJWT({
    purpose: paymentConfirmationPurpose,
    checkoutId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(paymentConfirmationTokenLifetime)
    .sign(getPaymentConfirmationSecret());
}

export async function verifyRegistrationPaymentConfirmationToken(
  token?: string | null,
) {
  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, getPaymentConfirmationSecret());

    if (
      payload.purpose !== paymentConfirmationPurpose ||
      typeof payload.checkoutId !== "string" ||
      payload.checkoutId.length === 0
    ) {
      return null;
    }

    return {
      checkoutId: payload.checkoutId,
    };
  } catch {
    return null;
  }
}

function getSquarePaymentLinkOrder(payload: SquarePaymentLinkDetailsResponse) {
  const orders = payload.related_resources?.orders ?? [];
  const matchingOrder = payload.payment_link?.order_id
    ? orders.find((order) => order.id === payload.payment_link?.order_id)
    : undefined;

  return matchingOrder ?? orders[0] ?? null;
}

export function isSquareOrderPaid(order?: SquareOrder | null) {
  const orderState = order?.state?.toUpperCase();

  if (orderState === "COMPLETED") {
    return true;
  }

  return (
    Boolean(order?.tenders?.length) && order?.net_amount_due_money?.amount === 0
  );
}

async function getSquareOrderState(
  orderId: string,
  accessToken: string,
): Promise<SquareOrder | null> {
  const response = await fetch(
    `${getSquareApiBaseUrl()}/orders/${encodeURIComponent(orderId)}`,
    {
      method: "GET",
      headers: getSquareRequestHeaders(accessToken),
      cache: "no-store",
    },
  );

  const payload = await readSquareResponse<SquareOrderResponse>(response);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok || !payload.order) {
    throw new Error(
      getSquareErrorDetail(payload.errors) || "Square order lookup failed.",
    );
  }

  return payload.order;
}

export async function getRegistrationPaymentLinkState(
  paymentReference: string,
): Promise<RegistrationPaymentLinkState | null> {
  const reference = paymentReference.trim();

  if (!reference) {
    return null;
  }

  const accessToken = getRequiredEnv("SQUARE_ACCESS_TOKEN");
  const response = await fetch(
    `${getSquareApiBaseUrl()}/online-checkout/payment-links/${encodeURIComponent(reference)}`,
    {
      method: "GET",
      headers: getSquareRequestHeaders(accessToken),
      cache: "no-store",
    },
  );

  const payload =
    await readSquareResponse<SquarePaymentLinkDetailsResponse>(response);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok || !payload.payment_link) {
    throw new Error(
      getSquareErrorDetail(payload.errors) ||
        "Square payment link lookup failed.",
    );
  }

  const relatedOrder = getSquarePaymentLinkOrder(payload);
  let orderState = relatedOrder?.state?.toUpperCase() ?? null;
  let isComplete = isSquareOrderPaid(relatedOrder);

  if (!relatedOrder && payload.payment_link.order_id) {
    const order = await getSquareOrderState(
      payload.payment_link.order_id,
      accessToken,
    );

    if (order) {
      orderState = order.state?.toUpperCase() ?? orderState;
      isComplete = isSquareOrderPaid(order);
    }
  }

  return {
    reference: payload.payment_link.id ?? reference,
    orderId: payload.payment_link.order_id ?? null,
    url: payload.payment_link.url ?? null,
    orderState,
    isComplete,
  };
}

export async function createRegistrationPaymentLink({
  checkoutId,
  email,
  adultGuestCount,
  childGuestCount,
}: {
  checkoutId: string;
  email: string;
  adultGuestCount: number;
  childGuestCount: number;
}) {
  const accessToken = getRequiredEnv("SQUARE_ACCESS_TOKEN");
  const locationId = getRequiredEnv("SQUARE_LOCATION_ID");
  const confirmationToken =
    await createRegistrationPaymentConfirmationToken(checkoutId);

  const breakdown = getRegistrationPaymentBreakdown({
    adultGuestCount,
    childGuestCount,
  });
  const response = await fetch(
    `${getSquareApiBaseUrl()}/online-checkout/payment-links`,
    {
      method: "POST",
      headers: getSquareRequestHeaders(accessToken),
      body: JSON.stringify({
        checkout_options: {
          redirect_url: `${getSiteUrl()}${getRegistrationPaymentConfirmationPath(
            checkoutId,
            confirmationToken,
          )}`,
        },
        idempotency_key: getRegistrationPaymentLinkIdempotencyKey(checkoutId),
        order: {
          location_id: locationId,
          line_items: breakdown.lineItems.map((item) =>
            toSquareOrderLineItem(item, breakdown.currency),
          ),
        },
        pre_populated_data: {
          buyer_email: email,
        },
      }),
      cache: "no-store",
    },
  );

  const payload = await readSquareResponse<SquarePaymentLinkResponse>(response);

  if (!response.ok || !payload.payment_link?.url) {
    throw new Error(
      getSquareErrorDetail(payload.errors) ||
        "Square payment link request failed.",
    );
  }

  return {
    reference: payload.payment_link.id ?? null,
    orderId: payload.payment_link.order_id ?? null,
    url: payload.payment_link.url,
  };
}
