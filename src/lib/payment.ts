import { formatCurrency } from "@/lib/format";
import { createHash } from "crypto";
import { jwtVerify, SignJWT } from "jose";

const squareVersion = "2026-03-18";
const registrationPaymentConfirmationPurpose =
  "registration-payment-confirmation";
const rsvpPaymentConfirmationPurpose = "rsvp-payment-confirmation";
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
  golferCount?: number;
  bbqOnlyAdultCount?: number;
  bbqOnlyKidCount?: number;
  adultGuestCount?: number;
  childGuestCount?: number;
};

export type RsvpAttendeeCounts = {
  adultAttendeeCount: number;
  childAttendeeCount: number;
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
  golferCount: number;
  golfPriceCents: number;
  golfPriceLabel: string;
  bbqOnlyAdultCount: number;
  bbqOnlyKidCount: number;
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

export type RsvpPaymentBreakdown = {
  currency: string;
  adultAttendeeCount: number;
  adultGuestPriceCents: number;
  adultGuestPriceLabel: string;
  childAttendeeCount: number;
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

function getRsvpPaymentLinkIdempotencyKey(checkoutId: string) {
  return createHash("sha256")
    .update(`rsvp-payment-link:${checkoutId}`)
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
        "REGISTRATION_BBQ_ADULT_PRICE_CENTS",
        "REGISTRATION_PRE_EVENT_ADULT_PRICE_CENTS",
        "REGISTRATION_PRE_EVENT_GUEST_PRICE_CENTS",
      ],
      0,
    ),
    childGuestPriceCents: parseMoneyCentsFromNames(
      [
        "REGISTRATION_BBQ_KID_PRICE_CENTS",
        "REGISTRATION_PRE_EVENT_CHILD_PRICE_CENTS",
      ],
      0,
    ),
  };
}

function normalizeRegistrationGuestCounts(
  guestCounts: RegistrationGuestCounts,
) {
  return {
    golferCount: guestCounts.golferCount ?? 1,
    bbqOnlyAdultCount:
      guestCounts.bbqOnlyAdultCount ?? guestCounts.adultGuestCount ?? 0,
    bbqOnlyKidCount:
      guestCounts.bbqOnlyKidCount ?? guestCounts.childGuestCount ?? 0,
  };
}

export function getRegistrationPaymentBreakdown(
  guestCounts: RegistrationGuestCounts,
): RegistrationPaymentBreakdown {
  const { golferCount, bbqOnlyAdultCount, bbqOnlyKidCount } =
    normalizeRegistrationGuestCounts(guestCounts);

  if (!Number.isInteger(golferCount) || golferCount < 1) {
    throw new Error("golferCount must be a positive integer.");
  }

  if (!Number.isInteger(bbqOnlyAdultCount) || bbqOnlyAdultCount < 0) {
    throw new Error("bbqOnlyAdultCount must be a non-negative integer.");
  }

  if (!Number.isInteger(bbqOnlyKidCount) || bbqOnlyKidCount < 0) {
    throw new Error("bbqOnlyKidCount must be a non-negative integer.");
  }

  const pricing = getRegistrationPricing();
  const lineItems = [
    buildLineItem(
      "Golf registration (BBQ included)",
      golferCount,
      pricing.golfPriceCents,
      pricing.currency,
    ),
  ];

  if (bbqOnlyAdultCount > 0) {
    lineItems.push(
      buildLineItem(
        "BBQ-only adults",
        bbqOnlyAdultCount,
        pricing.adultGuestPriceCents,
        pricing.currency,
      ),
    );
  }

  if (bbqOnlyKidCount > 0) {
    lineItems.push(
      buildLineItem(
        "BBQ-only kids",
        bbqOnlyKidCount,
        pricing.childGuestPriceCents,
        pricing.currency,
      ),
    );
  }

  const totalCents = lineItems.reduce((sum, item) => sum + item.totalCents, 0);

  return {
    ...pricing,
    golferCount,
    bbqOnlyAdultCount,
    bbqOnlyKidCount,
    adultGuestCount: bbqOnlyAdultCount,
    childGuestCount: bbqOnlyKidCount,
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

export function getRsvpPaymentBreakdown(
  attendeeCounts: RsvpAttendeeCounts,
): RsvpPaymentBreakdown {
  if (
    !Number.isInteger(attendeeCounts.adultAttendeeCount) ||
    attendeeCounts.adultAttendeeCount < 0
  ) {
    throw new Error("adultAttendeeCount must be a non-negative integer.");
  }

  if (
    !Number.isInteger(attendeeCounts.childAttendeeCount) ||
    attendeeCounts.childAttendeeCount < 0
  ) {
    throw new Error("childAttendeeCount must be a non-negative integer.");
  }

  if (
    attendeeCounts.adultAttendeeCount + attendeeCounts.childAttendeeCount <
    1
  ) {
    throw new Error("At least one RSVP attendee is required for payment.");
  }

  const pricing = getRegistrationPricing();
  const lineItems: RegistrationPaymentLineItem[] = [];

  if (attendeeCounts.adultAttendeeCount > 0) {
    lineItems.push(
      buildLineItem(
        "BBQ-only adults",
        attendeeCounts.adultAttendeeCount,
        pricing.adultGuestPriceCents,
        pricing.currency,
      ),
    );
  }

  if (attendeeCounts.childAttendeeCount > 0) {
    lineItems.push(
      buildLineItem(
        "BBQ-only kids",
        attendeeCounts.childAttendeeCount,
        pricing.childGuestPriceCents,
        pricing.currency,
      ),
    );
  }

  const totalCents = lineItems.reduce((sum, item) => sum + item.totalCents, 0);

  return {
    currency: pricing.currency,
    adultAttendeeCount: attendeeCounts.adultAttendeeCount,
    adultGuestPriceCents: pricing.adultGuestPriceCents,
    adultGuestPriceLabel: formatCurrency(
      pricing.adultGuestPriceCents,
      pricing.currency,
    ),
    childAttendeeCount: attendeeCounts.childAttendeeCount,
    childGuestPriceCents: pricing.childGuestPriceCents,
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

export function getRsvpCheckoutPaymentPath(checkoutId: string) {
  return `/register/payment?rsvpCheckout=${encodeURIComponent(checkoutId)}`;
}

export function getRegistrationPaymentConfirmationPath(
  checkoutId: string,
  token: string,
) {
  return `/register/payment/confirm?checkout=${encodeURIComponent(checkoutId)}&token=${encodeURIComponent(token)}`;
}

export function getRsvpPaymentConfirmationPath(
  checkoutId: string,
  token: string,
) {
  return `/register/payment/confirm?rsvpCheckout=${encodeURIComponent(checkoutId)}&token=${encodeURIComponent(token)}`;
}

export async function createRegistrationPaymentConfirmationToken(
  checkoutId: string,
) {
  return new SignJWT({
    purpose: registrationPaymentConfirmationPurpose,
    checkoutId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(paymentConfirmationTokenLifetime)
    .sign(getPaymentConfirmationSecret());
}

export async function createRsvpPaymentConfirmationToken(checkoutId: string) {
  return new SignJWT({
    purpose: rsvpPaymentConfirmationPurpose,
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
      payload.purpose !== registrationPaymentConfirmationPurpose ||
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

export async function verifyRsvpPaymentConfirmationToken(
  token?: string | null,
) {
  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, getPaymentConfirmationSecret());

    if (
      payload.purpose !== rsvpPaymentConfirmationPurpose ||
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
  golferCount,
  bbqOnlyAdultCount,
  bbqOnlyKidCount,
  adultGuestCount,
  childGuestCount,
}: {
  checkoutId: string;
  email: string;
  golferCount?: number;
  bbqOnlyAdultCount?: number;
  bbqOnlyKidCount?: number;
  adultGuestCount?: number;
  childGuestCount?: number;
}) {
  const accessToken = getRequiredEnv("SQUARE_ACCESS_TOKEN");
  const locationId = getRequiredEnv("SQUARE_LOCATION_ID");
  const confirmationToken =
    await createRegistrationPaymentConfirmationToken(checkoutId);

  const breakdown = getRegistrationPaymentBreakdown({
    golferCount,
    bbqOnlyAdultCount,
    bbqOnlyKidCount,
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

export async function createRsvpPaymentLink({
  checkoutId,
  email,
  adultAttendeeCount,
  childAttendeeCount,
}: {
  checkoutId: string;
  email: string;
  adultAttendeeCount: number;
  childAttendeeCount: number;
}) {
  const accessToken = getRequiredEnv("SQUARE_ACCESS_TOKEN");
  const locationId = getRequiredEnv("SQUARE_LOCATION_ID");
  const confirmationToken =
    await createRsvpPaymentConfirmationToken(checkoutId);

  const breakdown = getRsvpPaymentBreakdown({
    adultAttendeeCount,
    childAttendeeCount,
  });
  const response = await fetch(
    `${getSquareApiBaseUrl()}/online-checkout/payment-links`,
    {
      method: "POST",
      headers: getSquareRequestHeaders(accessToken),
      body: JSON.stringify({
        checkout_options: {
          redirect_url: `${getSiteUrl()}${getRsvpPaymentConfirmationPath(
            checkoutId,
            confirmationToken,
          )}`,
        },
        idempotency_key: getRsvpPaymentLinkIdempotencyKey(checkoutId),
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
