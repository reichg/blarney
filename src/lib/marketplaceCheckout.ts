import { db } from "@/lib/db";
import {
  buildMarketplaceCheckoutDraftInputSchema,
  marketplaceCheckoutDraftSchema,
  marketplaceCheckoutItemRecordSchema,
  marketplaceCheckoutPaymentAttemptRecordSchema,
  marketplaceCheckoutRecordSchema,
  marketplaceCheckoutRequestSchema,
  marketplaceOrderRecordSchema,
  marketplacePublicTokenSchema,
} from "@/lib/marketplaceCheckout.schema";
import type {
  BuildMarketplaceCheckoutDraftInput,
  CreateOrReuseMarketplacePendingCheckoutResult,
  GetMarketplacePendingCheckoutResult,
  MarketplaceCheckoutDraft,
  MarketplaceCheckoutItemRecord,
  MarketplaceCheckoutPaymentAttemptRecord,
  MarketplaceCheckoutPaymentResult,
  MarketplaceCheckoutRecord,
  MarketplaceCheckoutRequestInput,
  MarketplaceCheckoutStatus,
  MarketplaceOrderRecord,
  MarketplacePaymentAttemptStatus,
  MarketplacePublicToken,
} from "@/lib/marketplaceCheckout.types";
import { resolveMarketplaceListingImageUrl } from "@/lib/marketplaceListingImage";
import {
  createMarketplacePaymentLink,
  getMarketplaceCheckoutConfirmationUrl,
  getSquarePaymentLinkState,
  hasSquareCheckoutConfiguration,
} from "@/lib/payment";
import { Prisma } from "@prisma/client";
import { createHash, randomUUID } from "crypto";
import {
  getMarketplacePurchasableVariantsForCheckout,
  type MarketplaceCheckoutVariantRecord,
} from "./marketplaceCatalog";

const marketplaceCheckoutLifetimeMs = 1000 * 60 * 60 * 24;
const reusableMarketplaceCheckoutStatuses: MarketplaceCheckoutStatus[] = [
  "PENDING",
  "PAYMENT_REVIEW",
];
const reusableMarketplacePaymentAttemptStatuses =
  new Set<MarketplacePaymentAttemptStatus>(["PENDING", "OPEN", "REVIEW"]);

const marketplaceCheckoutStateInclude = {
  items: {
    orderBy: { lineNumber: "asc" },
  },
  paymentAttempts: {
    orderBy: { createdAt: "desc" },
  },
} satisfies Prisma.MarketplaceCheckoutInclude;

const marketplaceCheckoutFinalizationInclude = {
  items: {
    orderBy: { lineNumber: "asc" },
  },
  order: true,
  paymentAttempts: {
    orderBy: { createdAt: "desc" },
  },
} satisfies Prisma.MarketplaceCheckoutInclude;

type MarketplaceCheckoutStateRecord = Prisma.MarketplaceCheckoutGetPayload<{
  include: typeof marketplaceCheckoutStateInclude;
}>;

// type MarketplaceCheckoutFinalizationRecord =
//   Prisma.MarketplaceCheckoutGetPayload<{
//     include: typeof marketplaceCheckoutFinalizationInclude;
//   }>;

type FinalizeMarketplaceOrderResult =
  | {
      ok: true;
      orderId: string;
    }
  | {
      ok: false;
      reason: "review" | "unavailable";
    };

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  return `{${Object.entries(value)
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(",")}}`;
}

function cloneSnapshot<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeMarketplaceCheckoutRequest(
  input: MarketplaceCheckoutRequestInput,
) {
  const combinedItems = new Map<string, number>();

  for (const item of input.items) {
    const variantId = item.variantId.trim();
    combinedItems.set(
      variantId,
      (combinedItems.get(variantId) ?? 0) + item.quantity,
    );
  }

  return {
    ...input,
    items: [...combinedItems.entries()]
      .sort(([leftVariantId], [rightVariantId]) =>
        leftVariantId.localeCompare(rightVariantId),
      )
      .map(([variantId, quantity]) => ({
        variantId,
        quantity,
      })),
  };
}

function getSingleCurrency(items: Array<{ currency: string }>) {
  const currencies = new Set(items.map((item) => item.currency));

  if (currencies.size !== 1) {
    throw new Error("Marketplace checkout items must use a single currency.");
  }

  return items[0]?.currency ?? "USD";
}

function getMarketplaceCheckoutSnapshotHash(
  draft: Omit<MarketplaceCheckoutDraft, "snapshotHash">,
) {
  return createHash("sha256")
    .update(`marketplace-checkout-snapshot:${stableStringify(draft)}`)
    .digest("hex");
}

function getMarketplaceCheckoutExpiresAt(from = new Date()) {
  return new Date(from.getTime() + marketplaceCheckoutLifetimeMs);
}

function isMarketplaceCheckoutExpired(
  checkout: Pick<MarketplaceCheckoutRecord, "expiresAt" | "status">,
  now = new Date(),
) {
  return (
    reusableMarketplaceCheckoutStatuses.includes(checkout.status) &&
    checkout.expiresAt <= now
  );
}

function toNullableJsonValue(value: unknown) {
  return value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}

function isReusableMarketplacePaymentAttemptStatus(
  status: MarketplacePaymentAttemptStatus,
) {
  return reusableMarketplacePaymentAttemptStatuses.has(status);
}

async function expireMarketplaceCheckout(
  client: Pick<typeof db, "marketplaceCheckout">,
  checkoutId: string,
  now = new Date(),
) {
  await client.marketplaceCheckout.updateMany({
    where: {
      id: checkoutId,
      status: { in: reusableMarketplaceCheckoutStatuses },
      expiresAt: { lte: now },
    },
    data: {
      status: "EXPIRED",
      expiredAt: now,
    },
  });
}

function parseMarketplaceCheckoutItemRecord(record: unknown) {
  return marketplaceCheckoutItemRecordSchema.parse(
    record,
  ) satisfies MarketplaceCheckoutItemRecord;
}

function getPreferredMarketplacePaymentAttempt(
  checkout: MarketplaceCheckoutStateRecord,
) {
  return (
    checkout.paymentAttempts.find((attempt) =>
      isReusableMarketplacePaymentAttemptStatus(attempt.status),
    ) ??
    checkout.paymentAttempts[0] ??
    null
  );
}

function mapMarketplacePendingCheckoutState(
  checkout: MarketplaceCheckoutStateRecord,
  paymentAttempt = getPreferredMarketplacePaymentAttempt(checkout),
) {
  return {
    checkout: parseMarketplaceCheckoutRecord(checkout),
    items: checkout.items.map((item) =>
      parseMarketplaceCheckoutItemRecord(item),
    ),
    paymentAttempt: paymentAttempt
      ? parseMarketplaceCheckoutPaymentAttemptRecord(paymentAttempt)
      : null,
  };
}

function mapMarketplaceConfirmedPaymentResult(
  checkoutId: string,
  orderId: string,
): MarketplaceCheckoutPaymentResult {
  return {
    ok: true,
    status: "confirmed",
    checkoutId,
    orderId,
    paymentUrl: null,
  };
}

function getMarketplacePaymentItems(items: MarketplaceCheckoutItemRecord[]) {
  return items.map((item) => ({
    title: item.title,
    variantLabel: item.variantLabel,
    quantity: item.quantity,
    unitAmount: item.unitAmount,
  }));
}

async function markMarketplaceCheckoutPaymentReview(
  transaction: Prisma.TransactionClient,
  state: {
    checkoutId: string;
    paymentAttemptId: string;
  },
  paymentLink: {
    reference: string | null;
    orderId: string | null;
  },
  completedAt = new Date(),
) {
  const paymentAttemptData: Prisma.MarketplacePaymentAttemptUpdateManyMutationInput =
    {
      status: "REVIEW",
      completedAt,
      lastReconciledAt: completedAt,
    };

  if (paymentLink.reference) {
    paymentAttemptData.providerLinkId = paymentLink.reference;
  }

  if (paymentLink.orderId) {
    paymentAttemptData.providerOrderId = paymentLink.orderId;
  }

  await transaction.marketplaceCheckout.updateMany({
    where: {
      id: state.checkoutId,
      status: { not: "CONFIRMED" },
    },
    data: {
      status: "PAYMENT_REVIEW",
    },
  });
  await transaction.marketplacePaymentAttempt.updateMany({
    where: {
      id: state.paymentAttemptId,
    },
    data: paymentAttemptData,
  });
}

async function markMarketplacePaymentAttemptCompleted(
  paymentAttempt: MarketplaceCheckoutPaymentAttemptRecord,
  paymentLink: {
    reference: string | null;
    orderId: string | null;
  },
) {
  const completedAt = new Date();
  const paymentAttemptData: Prisma.MarketplacePaymentAttemptUpdateManyMutationInput =
    {
      status: "COMPLETED",
      completedAt,
      lastReconciledAt: completedAt,
    };

  if (paymentLink.reference) {
    paymentAttemptData.providerLinkId = paymentLink.reference;
  }

  if (paymentLink.orderId) {
    paymentAttemptData.providerOrderId = paymentLink.orderId;
  }

  const updateResult = await db.marketplacePaymentAttempt.updateMany({
    where: {
      id: paymentAttempt.id,
      updatedAt: paymentAttempt.updatedAt,
    },
    data: paymentAttemptData,
  });

  if (updateResult.count === 1) {
    return {
      ...paymentAttempt,
      status: "COMPLETED" as const,
      providerLinkId: paymentLink.reference ?? paymentAttempt.providerLinkId,
      providerOrderId: paymentLink.orderId ?? paymentAttempt.providerOrderId,
      completedAt,
      lastReconciledAt: completedAt,
      updatedAt: completedAt,
    } satisfies MarketplaceCheckoutPaymentAttemptRecord;
  }

  const latestAttempt = await db.marketplacePaymentAttempt.findUnique({
    where: { id: paymentAttempt.id },
  });

  if (!latestAttempt) {
    throw new Error(
      "Marketplace payment attempt disappeared during completion persistence.",
    );
  }

  return parseMarketplaceCheckoutPaymentAttemptRecord(latestAttempt);
}

async function persistMarketplacePaymentLink(
  paymentAttempt: MarketplaceCheckoutPaymentAttemptRecord,
  paymentLink: {
    reference: string;
    orderId: string | null;
    url: string;
  },
) {
  const reconciledAt = new Date();
  const updateResult = await db.marketplacePaymentAttempt.updateMany({
    where: {
      id: paymentAttempt.id,
      updatedAt: paymentAttempt.updatedAt,
      providerLinkId: paymentAttempt.providerLinkId,
    },
    data: {
      status: "OPEN",
      providerLinkId: paymentLink.reference,
      providerOrderId: paymentLink.orderId,
      paymentUrl: paymentLink.url,
      lastReconciledAt: reconciledAt,
    },
  });

  if (updateResult.count === 1) {
    return {
      ...paymentAttempt,
      status: "OPEN" as const,
      providerLinkId: paymentLink.reference,
      providerOrderId: paymentLink.orderId,
      paymentUrl: paymentLink.url,
      lastReconciledAt: reconciledAt,
      updatedAt: reconciledAt,
    } satisfies MarketplaceCheckoutPaymentAttemptRecord;
  }

  const latestAttempt = await db.marketplacePaymentAttempt.findUnique({
    where: { id: paymentAttempt.id },
  });

  if (!latestAttempt) {
    throw new Error(
      "Marketplace payment attempt disappeared during link persistence.",
    );
  }

  return parseMarketplaceCheckoutPaymentAttemptRecord(latestAttempt);
}

function mapMarketplacePendingPaymentResult(
  checkoutId: string,
  paymentAttempt: MarketplaceCheckoutPaymentAttemptRecord,
  fallbackLink: {
    reference: string;
    url: string;
  },
): MarketplaceCheckoutPaymentResult {
  return {
    ok: true,
    status: "pending",
    checkoutId,
    paymentAttemptId: paymentAttempt.id,
    paymentReference: paymentAttempt.providerLinkId ?? fallbackLink.reference,
    paymentUrl: paymentAttempt.paymentUrl ?? fallbackLink.url,
  };
}

async function finalizeMarketplaceCompletedCheckout(
  checkoutId: string,
  paymentAttemptId: string,
  paymentLink: {
    reference: string | null;
    orderId: string | null;
  },
): Promise<FinalizeMarketplaceOrderResult> {
  try {
    return await db.$transaction(async (transaction) => {
      const checkout = await transaction.marketplaceCheckout.findUnique({
        where: { id: checkoutId },
        include: marketplaceCheckoutFinalizationInclude,
      });

      if (!checkout) {
        return { ok: false, reason: "unavailable" };
      }

      const paymentAttempt = checkout.paymentAttempts.find(
        (attempt) => attempt.id === paymentAttemptId,
      );

      if (!paymentAttempt) {
        return { ok: false, reason: "unavailable" };
      }

      if (checkout.order) {
        if (checkout.status !== "CONFIRMED" || !checkout.confirmedAt) {
          await transaction.marketplaceCheckout.updateMany({
            where: {
              id: checkout.id,
            },
            data: {
              status: "CONFIRMED",
              confirmedAt: checkout.order.confirmedAt,
            },
          });
        }

        return { ok: true, orderId: checkout.order.id };
      }

      if (
        checkout.status === "PAYMENT_REVIEW" ||
        paymentAttempt.status === "REVIEW"
      ) {
        return { ok: false, reason: "review" };
      }

      if (
        checkout.status === "EXPIRED" ||
        checkout.status === "CANCELED" ||
        paymentAttempt.status !== "COMPLETED" ||
        checkout.items.length === 0 ||
        paymentAttempt.expectedCurrency !== checkout.currency ||
        paymentAttempt.expectedTotalAmount !== checkout.totalAmount
      ) {
        await markMarketplaceCheckoutPaymentReview(
          transaction,
          {
            checkoutId: checkout.id,
            paymentAttemptId: paymentAttempt.id,
          },
          paymentLink,
          paymentAttempt.completedAt ?? new Date(),
        );

        return { ok: false, reason: "review" };
      }

      const confirmedAt = paymentAttempt.completedAt ?? new Date();
      const createdOrder = await transaction.marketplaceOrder.create({
        data: {
          checkoutId: checkout.id,
          publicTokenHash: checkout.publicTokenHash,
          buyerEmail: checkout.buyerEmail,
          buyerName: checkout.buyerName,
          currency: checkout.currency,
          subtotalAmount: checkout.subtotalAmount,
          taxAmount: checkout.taxAmount,
          shippingAmount: checkout.shippingAmount,
          discountAmount: checkout.discountAmount,
          totalAmount: checkout.totalAmount,
          customerSnapshot: toNullableJsonValue(checkout.customerSnapshot),
          paymentProvider: paymentAttempt.provider,
          providerOrderId: paymentAttempt.providerOrderId,
          confirmedAt,
          items: {
            create: checkout.items.map((item) => ({
              listingId: item.listingId,
              variantId: item.variantId,
              lineNumber: item.lineNumber,
              title: item.title,
              variantLabel: item.variantLabel,
              sku: item.sku,
              quantity: item.quantity,
              currency: item.currency,
              unitAmount: item.unitAmount,
              totalAmount: item.totalAmount,
              detailSnapshot: item.detailSnapshot as Prisma.InputJsonValue,
            })),
          },
        },
      });

      await transaction.marketplaceCheckout.updateMany({
        where: {
          id: checkout.id,
        },
        data: {
          status: "CONFIRMED",
          confirmedAt,
        },
      });

      await transaction.marketplacePaymentAttempt.updateMany({
        where: {
          id: paymentAttempt.id,
        },
        data: {
          status: "COMPLETED",
          providerLinkId:
            paymentLink.reference ?? paymentAttempt.providerLinkId,
          providerOrderId:
            paymentLink.orderId ?? paymentAttempt.providerOrderId,
          completedAt: confirmedAt,
          lastReconciledAt: new Date(),
        },
      });

      return {
        ok: true,
        orderId: createdOrder.id,
      };
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      return { ok: false, reason: "unavailable" };
    }

    const existingOrder = await db.marketplaceOrder.findUnique({
      where: { checkoutId },
      select: { id: true },
    });

    if (!existingOrder) {
      return { ok: false, reason: "unavailable" };
    }

    return {
      ok: true,
      orderId: existingOrder.id,
    };
  }
}

async function ensureMarketplaceCheckoutPaymentLink(state: {
  checkout: MarketplaceCheckoutRecord;
  items: MarketplaceCheckoutItemRecord[];
  paymentAttempt: MarketplaceCheckoutPaymentAttemptRecord | null;
}): Promise<MarketplaceCheckoutPaymentResult> {
  if (state.checkout.status === "CONFIRMED") {
    const existingOrder = await db.marketplaceOrder.findUnique({
      where: { checkoutId: state.checkout.id },
      select: { id: true },
    });

    if (!existingOrder) {
      return { ok: false, reason: "review" };
    }

    return mapMarketplaceConfirmedPaymentResult(
      state.checkout.id,
      existingOrder.id,
    );
  }

  if (state.checkout.status === "PAYMENT_REVIEW") {
    return { ok: false, reason: "review" };
  }

  if (state.paymentAttempt?.status === "REVIEW") {
    return { ok: false, reason: "review" };
  }

  if (!state.paymentAttempt) {
    return { ok: false, reason: "unavailable" };
  }

  if (state.paymentAttempt.status === "COMPLETED") {
    const finalized = await finalizeMarketplaceCompletedCheckout(
      state.checkout.id,
      state.paymentAttempt.id,
      {
        reference: state.paymentAttempt.providerLinkId,
        orderId: state.paymentAttempt.providerOrderId,
      },
    );

    if (finalized.ok) {
      return mapMarketplaceConfirmedPaymentResult(
        state.checkout.id,
        finalized.orderId,
      );
    }

    return { ok: false, reason: finalized.reason };
  }

  if (!hasSquareCheckoutConfiguration()) {
    return { ok: false, reason: "configuration" };
  }

  const paymentAttempt = state.paymentAttempt;

  if (paymentAttempt.providerLinkId) {
    let paymentLink;

    try {
      paymentLink = await getSquarePaymentLinkState(
        paymentAttempt.providerLinkId,
      );
    } catch {
      return { ok: false, reason: "unavailable" };
    }

    if (paymentLink?.isComplete) {
      const completedAttempt = await markMarketplacePaymentAttemptCompleted(
        paymentAttempt,
        {
          reference: paymentLink.reference,
          orderId: paymentLink.orderId,
        },
      );

      const finalized = await finalizeMarketplaceCompletedCheckout(
        state.checkout.id,
        completedAttempt.id,
        {
          reference: paymentLink.reference,
          orderId: paymentLink.orderId,
        },
      );

      if (finalized.ok) {
        return mapMarketplaceConfirmedPaymentResult(
          state.checkout.id,
          finalized.orderId,
        );
      }

      return { ok: false, reason: finalized.reason };
    }

    if (paymentLink?.url) {
      const persistedAttempt = await persistMarketplacePaymentLink(
        paymentAttempt,
        {
          reference: paymentLink.reference,
          orderId: paymentLink.orderId,
          url: paymentLink.url,
        },
      );

      return mapMarketplacePendingPaymentResult(
        state.checkout.id,
        persistedAttempt,
        {
          reference: paymentLink.reference,
          url: paymentLink.url,
        },
      );
    }
  }

  let createdPaymentLink;

  try {
    createdPaymentLink = await createMarketplacePaymentLink({
      paymentAttemptId: paymentAttempt.id,
      email: state.checkout.buyerEmail,
      currency: state.checkout.currency,
      items: getMarketplacePaymentItems(state.items),
      redirectUrl: getMarketplaceCheckoutConfirmationUrl(state.checkout.id),
      staleReference: paymentAttempt.providerLinkId,
    });
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  if (!createdPaymentLink.reference) {
    return { ok: false, reason: "unavailable" };
  }

  const persistedAttempt = await persistMarketplacePaymentLink(paymentAttempt, {
    reference: createdPaymentLink.reference,
    orderId: createdPaymentLink.orderId,
    url: createdPaymentLink.url,
  });

  return mapMarketplacePendingPaymentResult(
    state.checkout.id,
    persistedAttempt,
    {
      reference: createdPaymentLink.reference,
      url: createdPaymentLink.url,
    },
  );
}

function buildMarketplaceCheckoutLineSnapshots(
  variantsById: Map<string, MarketplaceCheckoutVariantRecord>,
  items: ReturnType<typeof normalizeMarketplaceCheckoutRequest>["items"],
) {
  return items.map((item) => {
    const variant = variantsById.get(item.variantId);

    if (!variant) {
      return null;
    }

    if (
      variant.inventoryQuantity !== null &&
      variant.inventoryQuantity < item.quantity
    ) {
      return null;
    }

    return {
      productId: variant.listing.id,
      variantId: variant.id,
      title: variant.listing.title,
      variantLabel: variant.label,
      sku: variant.sku,
      quantity: item.quantity,
      currency: variant.currency,
      unitAmount: variant.unitAmount,
      detailSnapshot: {
        slug: variant.listing.slug,
        description: variant.listing.description ?? null,
        imageUrl: resolveMarketplaceListingImageUrl(variant.listing.imageUrl),
        fulfillmentNote: variant.listing.fulfillmentNote ?? null,
      },
    };
  });
}

async function resolveMarketplaceCheckoutDraft(
  transaction: Prisma.TransactionClient,
  input: ReturnType<typeof normalizeMarketplaceCheckoutRequest>,
) {
  const variants = await getMarketplacePurchasableVariantsForCheckout(
    input.items.map((item) => item.variantId),
    transaction,
  );
  const variantsById = new Map<string, MarketplaceCheckoutVariantRecord>(
    variants.map((variant): [string, MarketplaceCheckoutVariantRecord] => [
      variant.id,
      variant,
    ]),
  );
  const pricedItems = buildMarketplaceCheckoutLineSnapshots(
    variantsById,
    input.items,
  );

  if (pricedItems.some((item) => item === null)) {
    return null;
  }

  return buildMarketplaceCheckoutDraft({
    items: pricedItems.filter(
      (item): item is NonNullable<(typeof pricedItems)[number]> =>
        item !== null,
    ),
    customer: input.customer,
    requestSnapshot: input.requestSnapshot,
  });
}

async function findReusableMarketplaceCheckout(
  transaction: Prisma.TransactionClient,
  options: {
    idempotencyKey: string;
    snapshotHash: string;
  },
): Promise<MarketplaceCheckoutStateRecord | null> {
  const now = new Date();

  return transaction.marketplaceCheckout.findFirst({
    where: {
      status: { in: reusableMarketplaceCheckoutStatuses },
      expiresAt: { gt: now },
      OR: [
        { idempotencyKey: options.idempotencyKey },
        { snapshotHash: options.snapshotHash },
      ],
    },
    orderBy: { createdAt: "desc" },
    include: marketplaceCheckoutStateInclude,
  });
}

async function createMarketplacePaymentAttempt(
  transaction: Prisma.TransactionClient,
  checkout: MarketplaceCheckoutRecord,
  attemptNumber: number,
) {
  return transaction.marketplacePaymentAttempt.create({
    data: {
      checkoutId: checkout.id,
      idempotencyKey: getMarketplacePaymentAttemptIdempotencyKey(
        checkout.id,
        attemptNumber,
      ),
      expectedCurrency: checkout.currency,
      expectedTotalAmount: checkout.totalAmount,
      expiresAt: checkout.expiresAt,
    },
  });
}

async function ensureMarketplacePaymentAttempt(
  transaction: Prisma.TransactionClient,
  checkout: MarketplaceCheckoutStateRecord,
) {
  const reusableAttempt = checkout.paymentAttempts.find((attempt) =>
    isReusableMarketplacePaymentAttemptStatus(attempt.status),
  );

  if (reusableAttempt) {
    return {
      paymentAttempt:
        parseMarketplaceCheckoutPaymentAttemptRecord(reusableAttempt),
      reusedPaymentAttempt: true,
    };
  }

  try {
    const createdAttempt = await createMarketplacePaymentAttempt(
      transaction,
      parseMarketplaceCheckoutRecord(checkout),
      checkout.paymentAttempts.length + 1,
    );

    return {
      paymentAttempt:
        parseMarketplaceCheckoutPaymentAttemptRecord(createdAttempt),
      reusedPaymentAttempt: false,
    };
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    const latestCheckout = await transaction.marketplaceCheckout.findUnique({
      where: { id: checkout.id },
      include: marketplaceCheckoutStateInclude,
    });

    const latestAttempt = latestCheckout?.paymentAttempts.find((attempt) =>
      isReusableMarketplacePaymentAttemptStatus(attempt.status),
    );

    if (!latestAttempt) {
      throw error;
    }

    return {
      paymentAttempt:
        parseMarketplaceCheckoutPaymentAttemptRecord(latestAttempt),
      reusedPaymentAttempt: true,
    };
  }
}

export function getMarketplaceCheckoutIdempotencyKey(
  input: MarketplaceCheckoutRequestInput,
) {
  const parsedInput = marketplaceCheckoutRequestSchema.parse(input);
  const normalizedInput = normalizeMarketplaceCheckoutRequest(parsedInput);

  return createHash("sha256")
    .update(`marketplace-checkout:${stableStringify(normalizedInput)}`)
    .digest("hex");
}

export function createMarketplaceCheckoutPublicToken(): MarketplacePublicToken {
  return marketplacePublicTokenSchema.parse(randomUUID().replace(/-/g, ""));
}

export function getMarketplaceCheckoutPublicTokenHash(token: string) {
  const parsedToken = marketplacePublicTokenSchema.parse(token);

  return createHash("sha256")
    .update(`marketplace-checkout-public:${parsedToken}`)
    .digest("hex");
}

export function getMarketplacePaymentAttemptIdempotencyKey(
  checkoutId: string,
  attemptNumber = 1,
) {
  const normalizedCheckoutId = checkoutId.trim();

  if (!normalizedCheckoutId) {
    throw new Error("Marketplace checkout id is required.");
  }

  if (!Number.isInteger(attemptNumber) || attemptNumber < 1) {
    throw new Error("Marketplace payment attempt number must be >= 1.");
  }

  return createHash("sha256")
    .update(
      `marketplace-payment-attempt:${normalizedCheckoutId}:${attemptNumber}`,
    )
    .digest("hex");
}

export function buildMarketplaceCheckoutDraft(
  input: BuildMarketplaceCheckoutDraftInput,
) {
  const parsedInput = buildMarketplaceCheckoutDraftInputSchema.parse(input);
  const items = parsedInput.items.map((item, index) => ({
    lineNumber: index + 1,
    productId: item.productId,
    variantId: item.variantId,
    title: item.title,
    variantLabel: item.variantLabel,
    sku: item.sku,
    quantity: item.quantity,
    currency: item.currency,
    unitAmount: item.unitAmount,
    totalAmount: item.quantity * item.unitAmount,
    detailSnapshot: cloneSnapshot(item.detailSnapshot),
  }));
  const subtotalAmount = items.reduce(
    (total, item) => total + item.totalAmount,
    0,
  );
  const totalAmount =
    subtotalAmount +
    parsedInput.taxAmount +
    parsedInput.shippingAmount -
    parsedInput.discountAmount;

  if (totalAmount < 0) {
    throw new Error("Marketplace checkout total cannot be negative.");
  }

  const draftWithoutHash = {
    items,
    totals: {
      currency: getSingleCurrency(items),
      subtotalAmount,
      taxAmount: parsedInput.taxAmount,
      shippingAmount: parsedInput.shippingAmount,
      discountAmount: parsedInput.discountAmount,
      totalAmount,
    },
    customerSnapshot: parsedInput.customer
      ? cloneSnapshot(parsedInput.customer)
      : null,
    requestSnapshot: parsedInput.requestSnapshot
      ? cloneSnapshot(parsedInput.requestSnapshot)
      : null,
  };

  return marketplaceCheckoutDraftSchema.parse({
    ...draftWithoutHash,
    snapshotHash: getMarketplaceCheckoutSnapshotHash(draftWithoutHash),
  }) satisfies MarketplaceCheckoutDraft;
}

export function parseMarketplaceCheckoutRecord(record: unknown) {
  return marketplaceCheckoutRecordSchema.parse(
    record,
  ) satisfies MarketplaceCheckoutRecord;
}

export function parseMarketplaceCheckoutPaymentAttemptRecord(record: unknown) {
  return marketplaceCheckoutPaymentAttemptRecordSchema.parse(
    record,
  ) satisfies MarketplaceCheckoutPaymentAttemptRecord;
}

export function parseMarketplaceOrderRecord(record: unknown) {
  return marketplaceOrderRecordSchema.parse(
    record,
  ) satisfies MarketplaceOrderRecord;
}

export async function createOrReuseMarketplacePendingCheckout(
  input: MarketplaceCheckoutRequestInput,
): Promise<CreateOrReuseMarketplacePendingCheckoutResult> {
  const parsedInput = marketplaceCheckoutRequestSchema.parse(input);
  const normalizedInput = normalizeMarketplaceCheckoutRequest(parsedInput);
  const baseIdempotencyKey =
    getMarketplaceCheckoutIdempotencyKey(normalizedInput);

  return db.$transaction(async (transaction) => {
    const draft = await resolveMarketplaceCheckoutDraft(
      transaction,
      normalizedInput,
    );

    if (!draft) {
      return { ok: false, reason: "unavailable_items" };
    }

    const reusableCheckout = await findReusableMarketplaceCheckout(
      transaction,
      {
        idempotencyKey: baseIdempotencyKey,
        snapshotHash: draft.snapshotHash,
      },
    );

    if (reusableCheckout) {
      if (
        isMarketplaceCheckoutExpired(
          parseMarketplaceCheckoutRecord(reusableCheckout),
        )
      ) {
        await expireMarketplaceCheckout(transaction, reusableCheckout.id);
      } else {
        const { paymentAttempt, reusedPaymentAttempt } =
          await ensureMarketplacePaymentAttempt(transaction, reusableCheckout);
        const state = mapMarketplacePendingCheckoutState(
          reusableCheckout,
          paymentAttempt,
        );

        return {
          ok: true,
          ...state,
          reusedCheckout: true,
          reusedPaymentAttempt,
          requiresPaymentLinkCreation: paymentAttempt.paymentUrl === null,
        };
      }
    }

    const existingBaseCheckout =
      await transaction.marketplaceCheckout.findUnique({
        where: { idempotencyKey: baseIdempotencyKey },
        select: { id: true },
      });
    const persistedIdempotencyKey = existingBaseCheckout
      ? `${baseIdempotencyKey}:${randomUUID()}`
      : baseIdempotencyKey;
    const publicToken = createMarketplaceCheckoutPublicToken();
    const createdCheckout = await transaction.marketplaceCheckout.create({
      data: {
        idempotencyKey: persistedIdempotencyKey,
        publicTokenHash: getMarketplaceCheckoutPublicTokenHash(publicToken),
        snapshotHash: draft.snapshotHash,
        buyerEmail: draft.customerSnapshot?.email ?? null,
        buyerName: draft.customerSnapshot?.name ?? null,
        currency: draft.totals.currency,
        subtotalAmount: draft.totals.subtotalAmount,
        taxAmount: draft.totals.taxAmount,
        shippingAmount: draft.totals.shippingAmount,
        discountAmount: draft.totals.discountAmount,
        totalAmount: draft.totals.totalAmount,
        requestSnapshot: toNullableJsonValue(draft.requestSnapshot),
        customerSnapshot: toNullableJsonValue(draft.customerSnapshot),
        expiresAt: getMarketplaceCheckoutExpiresAt(),
        items: {
          create: draft.items.map((item) => ({
            listingId: item.productId,
            variantId: item.variantId,
            lineNumber: item.lineNumber,
            title: item.title,
            variantLabel: item.variantLabel,
            sku: item.sku,
            quantity: item.quantity,
            currency: item.currency,
            unitAmount: item.unitAmount,
            totalAmount: item.totalAmount,
            detailSnapshot: item.detailSnapshot as Prisma.InputJsonValue,
          })),
        },
      },
      include: marketplaceCheckoutStateInclude,
    });
    const createdAttempt = await createMarketplacePaymentAttempt(
      transaction,
      parseMarketplaceCheckoutRecord(createdCheckout),
      1,
    );
    const state = mapMarketplacePendingCheckoutState(
      createdCheckout,
      parseMarketplaceCheckoutPaymentAttemptRecord(createdAttempt),
    );

    return {
      ok: true,
      ...state,
      reusedCheckout: false,
      reusedPaymentAttempt: false,
      requiresPaymentLinkCreation: true,
    };
  });
}

export async function getMarketplacePendingCheckout(
  checkoutId: string,
): Promise<GetMarketplacePendingCheckoutResult> {
  const checkout = await db.marketplaceCheckout.findUnique({
    where: { id: checkoutId },
    include: marketplaceCheckoutStateInclude,
  });

  if (!checkout) {
    return { ok: false, reason: "not_found" };
  }

  if (
    checkout.status === "EXPIRED" ||
    isMarketplaceCheckoutExpired(parseMarketplaceCheckoutRecord(checkout))
  ) {
    if (checkout.status !== "EXPIRED") {
      await expireMarketplaceCheckout(db, checkout.id);
    }

    return { ok: false, reason: "expired" };
  }

  return {
    ok: true,
    ...mapMarketplacePendingCheckoutState(checkout),
  };
}

export async function createMarketplaceCheckoutPayment(
  input: MarketplaceCheckoutRequestInput,
): Promise<MarketplaceCheckoutPaymentResult> {
  const checkoutState = await createOrReuseMarketplacePendingCheckout(input);

  if (!checkoutState.ok) {
    return checkoutState;
  }

  return ensureMarketplaceCheckoutPaymentLink(checkoutState);
}

export async function getMarketplaceCheckoutPayment(
  checkoutId: string,
): Promise<MarketplaceCheckoutPaymentResult> {
  const checkoutState = await getMarketplacePendingCheckout(checkoutId);

  if (!checkoutState.ok) {
    return checkoutState;
  }

  return ensureMarketplaceCheckoutPaymentLink(checkoutState);
}

export async function confirmMarketplaceCheckoutPaymentByOrderId(
  paymentOrderId: string,
): Promise<MarketplaceCheckoutPaymentResult> {
  const orderId = paymentOrderId.trim();

  if (!orderId) {
    return { ok: false, reason: "not_found" };
  }

  const paymentAttempt = await db.marketplacePaymentAttempt.findUnique({
    where: { providerOrderId: orderId },
  });

  if (!paymentAttempt) {
    return { ok: false, reason: "not_found" };
  }

  if (paymentAttempt.status === "REVIEW") {
    return { ok: false, reason: "review" };
  }

  const completedAttempt =
    paymentAttempt.status === "COMPLETED"
      ? parseMarketplaceCheckoutPaymentAttemptRecord(paymentAttempt)
      : await markMarketplacePaymentAttemptCompleted(
          parseMarketplaceCheckoutPaymentAttemptRecord(paymentAttempt),
          {
            reference: paymentAttempt.providerLinkId,
            orderId,
          },
        );

  const finalized = await finalizeMarketplaceCompletedCheckout(
    completedAttempt.checkoutId,
    completedAttempt.id,
    {
      reference: completedAttempt.providerLinkId,
      orderId: completedAttempt.providerOrderId,
    },
  );

  if (!finalized.ok) {
    return { ok: false, reason: finalized.reason };
  }

  return mapMarketplaceConfirmedPaymentResult(
    completedAttempt.checkoutId,
    finalized.orderId,
  );
}
