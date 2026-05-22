import "server-only";

import { db } from "@/lib/db";
import {
  marketplaceCheckoutCustomerSchema,
  marketplaceFulfillmentStatusSchema,
} from "@/lib/marketplaceCheckout.schema";
import type {
  MarketplaceCheckoutCustomer,
  MarketplaceCheckoutStatus,
  MarketplaceFulfillmentStatus,
  MarketplacePaymentAttemptStatus,
} from "@/lib/marketplaceCheckout.types";
import { Prisma } from "@prisma/client";
import { z } from "zod";

const marketplaceChairReviewLimit = 12;
const marketplaceChairActiveOrderLimit = 18;
const marketplaceChairFulfillmentHistoryLimit = 8;

const marketplaceChairReviewWhere = {
  OR: [
    { status: "PAYMENT_REVIEW" },
    {
      paymentAttempts: {
        some: {
          status: "REVIEW",
        },
      },
    },
  ],
} satisfies Prisma.MarketplaceCheckoutWhereInput;

const marketplaceChairReviewCheckoutSelect = {
  id: true,
  buyerEmail: true,
  buyerName: true,
  status: true,
  currency: true,
  totalAmount: true,
  customerSnapshot: true,
  expiresAt: true,
  createdAt: true,
  items: {
    orderBy: {
      lineNumber: "asc",
    },
    select: {
      id: true,
      title: true,
      variantLabel: true,
      quantity: true,
      currency: true,
      totalAmount: true,
      detailSnapshot: true,
    },
  },
  paymentAttempts: {
    orderBy: {
      createdAt: "desc",
    },
    take: 1,
    select: {
      id: true,
      status: true,
      providerLinkId: true,
      providerOrderId: true,
      createdAt: true,
      completedAt: true,
      lastReconciledAt: true,
    },
  },
} satisfies Prisma.MarketplaceCheckoutSelect;

const marketplaceChairOrderSelect = {
  id: true,
  checkoutId: true,
  buyerEmail: true,
  buyerName: true,
  currency: true,
  totalAmount: true,
  customerSnapshot: true,
  providerOrderId: true,
  fulfillmentStatus: true,
  confirmedAt: true,
  updatedAt: true,
  items: {
    orderBy: {
      lineNumber: "asc",
    },
    select: {
      id: true,
      title: true,
      variantLabel: true,
      quantity: true,
      currency: true,
      totalAmount: true,
      detailSnapshot: true,
    },
  },
} satisfies Prisma.MarketplaceOrderSelect;

type MarketplaceChairReviewCheckoutRecord =
  Prisma.MarketplaceCheckoutGetPayload<{
    select: typeof marketplaceChairReviewCheckoutSelect;
  }>;

type MarketplaceChairOrderRecord = Prisma.MarketplaceOrderGetPayload<{
  select: typeof marketplaceChairOrderSelect;
}>;

type MarketplaceChairClient = Pick<
  typeof db,
  "marketplaceCheckout" | "marketplaceOrder"
>;

type MarketplaceChairMutationClient = Pick<typeof db, "marketplaceOrder">;

const marketplaceChairCustomerSnapshotSchema =
  marketplaceCheckoutCustomerSchema.nullable();

const marketplaceChairItemDetailSchema = z
  .object({
    fulfillmentNote: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .nullish()
      .transform((value) => value ?? null),
  })
  .strip();

const marketplaceChairFulfillmentTransitionSchema = z.object({
  orderId: z.string().trim().min(1),
  nextStatus: z.enum(["READY", "FULFILLED"]),
});

export type ChairMarketplaceLineItem = {
  id: string;
  title: string;
  variantLabel: string | null;
  quantity: number;
  currency: string;
  totalAmount: number;
  fulfillmentNote: string | null;
};

export type ChairMarketplaceReviewEntry = {
  id: string;
  buyerEmail: string | null;
  buyerName: string | null;
  phone: string | null;
  checkoutStatus: MarketplaceCheckoutStatus;
  paymentStatus: MarketplacePaymentAttemptStatus | null;
  paymentReference: string | null;
  providerOrderId: string | null;
  currency: string;
  totalAmount: number;
  itemCount: number;
  createdAt: Date;
  expiresAt: Date;
  items: ChairMarketplaceLineItem[];
};

export type ChairMarketplaceOrderEntry = {
  id: string;
  checkoutId: string;
  buyerEmail: string | null;
  buyerName: string | null;
  phone: string | null;
  fulfillmentStatus: MarketplaceFulfillmentStatus;
  providerOrderId: string | null;
  currency: string;
  totalAmount: number;
  itemCount: number;
  confirmedAt: Date;
  updatedAt: Date;
  items: ChairMarketplaceLineItem[];
};

export type ChairMarketplaceOverview = {
  counts: {
    review: number;
    unfulfilled: number;
    ready: number;
    fulfilled: number;
  };
  reviewQueue: ChairMarketplaceReviewEntry[];
  activeOrders: ChairMarketplaceOrderEntry[];
  recentFulfilledOrders: ChairMarketplaceOrderEntry[];
};

export type UpdateMarketplaceOrderFulfillmentStatusInput = z.input<
  typeof marketplaceChairFulfillmentTransitionSchema
>;

export type UpdateMarketplaceOrderFulfillmentStatusResult =
  | {
      ok: true;
      orderId: string;
      status: "READY" | "FULFILLED";
    }
  | {
      ok: false;
      reason: "invalid_transition" | "not_found";
    };

function getEmptyChairMarketplaceOverview(): ChairMarketplaceOverview {
  return {
    counts: {
      review: 0,
      unfulfilled: 0,
      ready: 0,
      fulfilled: 0,
    },
    reviewQueue: [],
    activeOrders: [],
    recentFulfilledOrders: [],
  };
}

function parseCustomerSnapshot(
  snapshot: unknown,
): MarketplaceCheckoutCustomer | null {
  const parsed = marketplaceChairCustomerSnapshotSchema.safeParse(snapshot);

  return parsed.success ? parsed.data : null;
}

function getItemFulfillmentNote(snapshot: unknown) {
  const parsed = marketplaceChairItemDetailSchema.safeParse(snapshot);

  return parsed.success ? parsed.data.fulfillmentNote : null;
}

function mapChairMarketplaceLineItems(
  items: Array<{
    id: string;
    title: string;
    variantLabel: string | null;
    quantity: number;
    currency: string;
    totalAmount: number;
    detailSnapshot: unknown;
  }>,
): ChairMarketplaceLineItem[] {
  return items.map((item) => ({
    id: item.id,
    title: item.title,
    variantLabel: item.variantLabel,
    quantity: item.quantity,
    currency: item.currency,
    totalAmount: item.totalAmount,
    fulfillmentNote: getItemFulfillmentNote(item.detailSnapshot),
  }));
}

function mapChairMarketplaceReviewEntry(
  checkout: MarketplaceChairReviewCheckoutRecord,
): ChairMarketplaceReviewEntry {
  const customer = parseCustomerSnapshot(checkout.customerSnapshot);
  const latestPaymentAttempt = checkout.paymentAttempts[0] ?? null;

  return {
    id: checkout.id,
    buyerEmail: checkout.buyerEmail,
    buyerName: checkout.buyerName,
    phone: customer?.phone ?? null,
    checkoutStatus: checkout.status,
    paymentStatus: latestPaymentAttempt?.status ?? null,
    paymentReference: latestPaymentAttempt?.providerLinkId ?? null,
    providerOrderId: latestPaymentAttempt?.providerOrderId ?? null,
    currency: checkout.currency,
    totalAmount: checkout.totalAmount,
    itemCount: checkout.items.reduce(
      (itemCount, item) => itemCount + item.quantity,
      0,
    ),
    createdAt: checkout.createdAt,
    expiresAt: checkout.expiresAt,
    items: mapChairMarketplaceLineItems(checkout.items),
  };
}

function mapChairMarketplaceOrderEntry(
  order: MarketplaceChairOrderRecord,
): ChairMarketplaceOrderEntry {
  const customer = parseCustomerSnapshot(order.customerSnapshot);

  return {
    id: order.id,
    checkoutId: order.checkoutId,
    buyerEmail: order.buyerEmail,
    buyerName: order.buyerName,
    phone: customer?.phone ?? null,
    fulfillmentStatus: order.fulfillmentStatus,
    providerOrderId: order.providerOrderId,
    currency: order.currency,
    totalAmount: order.totalAmount,
    itemCount: order.items.reduce(
      (itemCount, item) => itemCount + item.quantity,
      0,
    ),
    confirmedAt: order.confirmedAt,
    updatedAt: order.updatedAt,
    items: mapChairMarketplaceLineItems(order.items),
  };
}

export async function getChairMarketplaceOverview(
  client: MarketplaceChairClient = db,
): Promise<ChairMarketplaceOverview> {
  try {
    const [
      reviewCount,
      unfulfilledCount,
      readyCount,
      fulfilledCount,
      reviewQueue,
      activeOrders,
      recentFulfilledOrders,
    ] = await Promise.all([
      client.marketplaceCheckout.count({
        where: marketplaceChairReviewWhere,
      }),
      client.marketplaceOrder.count({
        where: {
          fulfillmentStatus: "UNFULFILLED",
        },
      }),
      client.marketplaceOrder.count({
        where: {
          fulfillmentStatus: "READY",
        },
      }),
      client.marketplaceOrder.count({
        where: {
          fulfillmentStatus: "FULFILLED",
        },
      }),
      client.marketplaceCheckout.findMany({
        where: marketplaceChairReviewWhere,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: marketplaceChairReviewLimit,
        select: marketplaceChairReviewCheckoutSelect,
      }),
      client.marketplaceOrder.findMany({
        where: {
          fulfillmentStatus: {
            in: ["UNFULFILLED", "READY"],
          },
        },
        orderBy: [{ confirmedAt: "desc" }, { id: "desc" }],
        take: marketplaceChairActiveOrderLimit,
        select: marketplaceChairOrderSelect,
      }),
      client.marketplaceOrder.findMany({
        where: {
          fulfillmentStatus: "FULFILLED",
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: marketplaceChairFulfillmentHistoryLimit,
        select: marketplaceChairOrderSelect,
      }),
    ]);

    return {
      counts: {
        review: reviewCount,
        unfulfilled: unfulfilledCount,
        ready: readyCount,
        fulfilled: fulfilledCount,
      },
      reviewQueue: reviewQueue.map(mapChairMarketplaceReviewEntry),
      activeOrders: activeOrders.map(mapChairMarketplaceOrderEntry),
      recentFulfilledOrders: recentFulfilledOrders.map(
        mapChairMarketplaceOrderEntry,
      ),
    };
  } catch {
    return getEmptyChairMarketplaceOverview();
  }
}

function getRequiredCurrentFulfillmentStatus(
  nextStatus: "READY" | "FULFILLED",
) {
  return nextStatus === "READY" ? "UNFULFILLED" : "READY";
}

export async function updateMarketplaceOrderFulfillmentStatus(
  input: UpdateMarketplaceOrderFulfillmentStatusInput,
  client: MarketplaceChairMutationClient = db,
): Promise<UpdateMarketplaceOrderFulfillmentStatusResult> {
  const parsed = marketplaceChairFulfillmentTransitionSchema.parse(input);
  const currentOrder = await client.marketplaceOrder.findUnique({
    where: {
      id: parsed.orderId,
    },
    select: {
      id: true,
      fulfillmentStatus: true,
    },
  });

  if (!currentOrder) {
    return {
      ok: false,
      reason: "not_found",
    };
  }

  if (currentOrder.fulfillmentStatus === parsed.nextStatus) {
    return {
      ok: true,
      orderId: currentOrder.id,
      status: parsed.nextStatus,
    };
  }

  if (
    currentOrder.fulfillmentStatus !==
    getRequiredCurrentFulfillmentStatus(parsed.nextStatus)
  ) {
    return {
      ok: false,
      reason: "invalid_transition",
    };
  }

  const updateResult = await client.marketplaceOrder.updateMany({
    where: {
      id: parsed.orderId,
      fulfillmentStatus: getRequiredCurrentFulfillmentStatus(parsed.nextStatus),
    },
    data: {
      fulfillmentStatus: parsed.nextStatus,
    },
  });

  if (updateResult.count === 1) {
    return {
      ok: true,
      orderId: parsed.orderId,
      status: parsed.nextStatus,
    };
  }

  const latestOrder = await client.marketplaceOrder.findUnique({
    where: {
      id: parsed.orderId,
    },
    select: {
      id: true,
      fulfillmentStatus: true,
    },
  });

  if (!latestOrder) {
    return {
      ok: false,
      reason: "not_found",
    };
  }

  if (latestOrder.fulfillmentStatus === parsed.nextStatus) {
    return {
      ok: true,
      orderId: latestOrder.id,
      status: parsed.nextStatus,
    };
  }

  return {
    ok: false,
    reason: "invalid_transition",
  };
}
