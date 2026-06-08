import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  createMarketplacePaymentLink,
  dbTransaction,
  getSquarePaymentLinkState,
  hasSquareCheckoutConfiguration,
  readOrderFindUnique,
  txVariantFindMany,
  txListingVariantUpdateMany,
  txCheckoutFindFirst,
  txCheckoutFindUnique,
  txCheckoutUpdateMany,
  txCheckoutCreate,
  txOrderCreate,
  txOrderFindUnique,
  txPaymentAttemptCreate,
  txPaymentAttemptFindUnique,
  txPaymentAttemptUpdateMany,
  readCheckoutFindUnique,
  readCheckoutUpdateMany,
} = vi.hoisted(() => ({
  createMarketplacePaymentLink: vi.fn(),
  dbTransaction: vi.fn(),
  getSquarePaymentLinkState: vi.fn(),
  hasSquareCheckoutConfiguration: vi.fn(),
  readOrderFindUnique: vi.fn(),
  txVariantFindMany: vi.fn(),
  txListingVariantUpdateMany: vi.fn(),
  txCheckoutFindFirst: vi.fn(),
  txCheckoutFindUnique: vi.fn(),
  txCheckoutUpdateMany: vi.fn(),
  txCheckoutCreate: vi.fn(),
  txOrderCreate: vi.fn(),
  txOrderFindUnique: vi.fn(),
  txPaymentAttemptCreate: vi.fn(),
  txPaymentAttemptFindUnique: vi.fn(),
  txPaymentAttemptUpdateMany: vi.fn(),
  readCheckoutFindUnique: vi.fn(),
  readCheckoutUpdateMany: vi.fn(),
}));

vi.mock("@/lib/payment", () => ({
  createMarketplacePaymentLink,
  getSquarePaymentLinkState,
  hasSquareCheckoutConfiguration,
  getMarketplaceCheckoutConfirmationUrl: (checkoutId: string) =>
    `https://blarney.test/marketplace/checkout/${checkoutId}`,
}));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: dbTransaction,
    marketplaceCheckout: {
      findUnique: readCheckoutFindUnique,
      updateMany: readCheckoutUpdateMany,
    },
    marketplaceOrder: {
      findUnique: readOrderFindUnique,
    },
    marketplacePaymentAttempt: {
      findUnique: txPaymentAttemptFindUnique,
      updateMany: txPaymentAttemptUpdateMany,
    },
  },
}));

import {
  confirmMarketplaceCheckoutPaymentByOrderId,
  createMarketplaceCheckoutPayment,
  createOrReuseMarketplacePendingCheckout,
  getMarketplaceCheckoutPayment,
  getMarketplacePendingCheckout,
} from "@/lib/marketplaceCheckout";

function buildOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "order-1",
    checkoutId: "checkout-1",
    publicTokenHash:
      "fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321",
    buyerEmail: "buyer@example.com",
    buyerName: "Pat Buyer",
    currency: "USD",
    subtotalAmount: 14200,
    taxAmount: 0,
    shippingAmount: 0,
    discountAmount: 0,
    totalAmount: 14200,
    customerSnapshot: {
      email: "buyer@example.com",
      name: "Pat Buyer",
      phone: "555-0100",
    },
    paymentProvider: "SQUARE",
    providerOrderId: "marketplace-order-123",
    fulfillmentStatus: "UNFULFILLED",
    confirmedAt: new Date("2026-05-19T12:30:00.000Z"),
    createdAt: new Date("2026-05-19T12:30:00.000Z"),
    updatedAt: new Date("2026-05-19T12:30:00.000Z"),
    ...overrides,
  };
}

function buildVariant(overrides: Record<string, unknown> = {}) {
  return {
    id: "variant-hoodie-m",
    label: "Medium",
    sku: "HOODIE-M",
    unitAmount: 4500,
    currency: "USD",
    inventoryQuantity: null,
    listing: {
      id: "listing-hoodie",
      slug: "hoodie",
      title: "Blarney Hoodie",
      description: "Warm layer",
      imageUrl: "/images/hoodie.jpg",
      fulfillmentNote: "Pickup at check-in",
    },
    ...overrides,
  };
}

function buildPaymentAttempt(overrides: Record<string, unknown> = {}) {
  return {
    id: "attempt-1",
    checkoutId: "checkout-1",
    provider: "SQUARE",
    status: "PENDING",
    idempotencyKey:
      "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    expectedCurrency: "USD",
    expectedTotalAmount: 14200,
    providerLinkId: null,
    providerOrderId: null,
    providerPaymentId: null,
    paymentUrl: null,
    expiresAt: new Date("2027-05-20T12:00:00.000Z"),
    completedAt: null,
    lastReconciledAt: null,
    createdAt: new Date("2026-05-19T12:00:00.000Z"),
    updatedAt: new Date("2026-05-19T12:00:00.000Z"),
    ...overrides,
  };
}

function buildCheckoutState(overrides: Record<string, unknown> = {}) {
  return {
    id: "checkout-1",
    idempotencyKey:
      "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    publicTokenHash:
      "fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321",
    snapshotHash:
      "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff",
    buyerEmail: "buyer@example.com",
    buyerName: "Pat Buyer",
    status: "PENDING",
    currency: "USD",
    subtotalAmount: 14200,
    taxAmount: 0,
    shippingAmount: 0,
    discountAmount: 0,
    totalAmount: 14200,
    requestSnapshot: { source: "marketplace" },
    customerSnapshot: {
      email: "buyer@example.com",
      name: "Pat Buyer",
      phone: "555-0100",
    },
    expiresAt: new Date("2027-05-20T12:00:00.000Z"),
    confirmedAt: null,
    canceledAt: null,
    expiredAt: null,
    createdAt: new Date("2026-05-19T12:00:00.000Z"),
    updatedAt: new Date("2026-05-19T12:00:00.000Z"),
    items: [
      {
        id: "item-1",
        checkoutId: "checkout-1",
        listingId: "listing-hoodie",
        variantId: "variant-hoodie-m",
        lineNumber: 1,
        title: "Blarney Hoodie",
        variantLabel: "Medium",
        sku: "HOODIE-M",
        quantity: 2,
        currency: "USD",
        unitAmount: 4500,
        totalAmount: 9000,
        detailSnapshot: {
          slug: "hoodie",
          description: "Warm layer",
          imageUrl: "/images/hoodie.jpg",
          fulfillmentNote: "Pickup at check-in",
        },
        createdAt: new Date("2026-05-19T12:00:00.000Z"),
      },
      {
        id: "item-2",
        checkoutId: "checkout-1",
        listingId: "listing-polo",
        variantId: "variant-polo-l",
        lineNumber: 2,
        title: "Blarney Polo",
        variantLabel: "Large",
        sku: "POLO-L",
        quantity: 1,
        currency: "USD",
        unitAmount: 5200,
        totalAmount: 5200,
        detailSnapshot: {
          slug: "polo",
          description: "Classic fit",
          imageUrl: "/images/polo.jpg",
          fulfillmentNote: "Pickup at check-in",
        },
        createdAt: new Date("2026-05-19T12:00:00.000Z"),
      },
    ],
    paymentAttempts: [buildPaymentAttempt()],
    ...overrides,
  };
}

beforeEach(() => {
  dbTransaction.mockImplementation((input) => {
    if (typeof input === "function") {
      return input({
        marketplaceListingVariant: {
          findMany: txVariantFindMany,
          updateMany: txListingVariantUpdateMany,
        },
        marketplaceCheckout: {
          findFirst: txCheckoutFindFirst,
          findUnique: txCheckoutFindUnique,
          updateMany: txCheckoutUpdateMany,
          create: txCheckoutCreate,
        },
        marketplaceOrder: {
          create: txOrderCreate,
          findUnique: txOrderFindUnique,
        },
        marketplacePaymentAttempt: {
          findUnique: txPaymentAttemptFindUnique,
          updateMany: txPaymentAttemptUpdateMany,
          create: txPaymentAttemptCreate,
        },
      });
    }

    return Promise.all(input);
  });

  hasSquareCheckoutConfiguration.mockReturnValue(true);
  createMarketplacePaymentLink.mockResolvedValue({
    reference: "marketplace-payment-link-id",
    orderId: "marketplace-order-123",
    url: "https://square.link/u/marketplace-payment",
  });
  getSquarePaymentLinkState.mockResolvedValue(null);
  txVariantFindMany.mockResolvedValue([]);
  txListingVariantUpdateMany.mockResolvedValue({ count: 1 });
  txCheckoutFindFirst.mockResolvedValue(null);
  txCheckoutFindUnique.mockResolvedValue(null);
  txCheckoutUpdateMany.mockResolvedValue({ count: 1 });
  txOrderCreate.mockResolvedValue(buildOrder());
  txOrderFindUnique.mockResolvedValue(null);
  txPaymentAttemptFindUnique.mockResolvedValue(null);
  txPaymentAttemptUpdateMany.mockResolvedValue({ count: 1 });
  readCheckoutFindUnique.mockResolvedValue(null);
  readOrderFindUnique.mockResolvedValue(null);
  readCheckoutUpdateMany.mockResolvedValue({ count: 1 });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("marketplace checkout service", () => {
  it("persists a server-priced checkout snapshot and initial payment attempt", async () => {
    txVariantFindMany.mockResolvedValue([
      buildVariant(),
      buildVariant({
        id: "variant-polo-l",
        label: "Large",
        sku: "POLO-L",
        unitAmount: 5200,
        listing: {
          id: "listing-polo",
          slug: "polo",
          title: "Blarney Polo",
          description: "Classic fit",
          imageUrl: "/images/polo.jpg",
          fulfillmentNote: "Pickup at check-in",
        },
      }),
    ]);
    txCheckoutCreate.mockImplementation(async ({ data }) => ({
      ...buildCheckoutState({
        idempotencyKey: data.idempotencyKey,
        publicTokenHash: data.publicTokenHash,
        snapshotHash: data.snapshotHash,
        buyerEmail: data.buyerEmail,
        buyerName: data.buyerName,
        currency: data.currency,
        subtotalAmount: data.subtotalAmount,
        taxAmount: data.taxAmount,
        shippingAmount: data.shippingAmount,
        discountAmount: data.discountAmount,
        totalAmount: data.totalAmount,
        requestSnapshot: data.requestSnapshot,
        customerSnapshot: data.customerSnapshot,
        expiresAt: data.expiresAt,
        items: data.items.create.map(
          (item: Record<string, unknown>, index: number) => ({
            id: `item-${index + 1}`,
            checkoutId: "checkout-1",
            createdAt: new Date("2026-05-19T12:00:00.000Z"),
            ...item,
          }),
        ),
        paymentAttempts: [],
      }),
    }));
    txPaymentAttemptCreate.mockImplementation(async ({ data }) =>
      buildPaymentAttempt({
        id: "attempt-1",
        checkoutId: data.checkoutId,
        idempotencyKey: data.idempotencyKey,
        expectedCurrency: data.expectedCurrency,
        expectedTotalAmount: data.expectedTotalAmount,
        expiresAt: data.expiresAt,
      }),
    );

    const result = await createOrReuseMarketplacePendingCheckout({
      items: [
        { variantId: "variant-hoodie-m", quantity: 2 },
        { variantId: "variant-polo-l", quantity: 1 },
      ],
      customer: {
        email: "Buyer@Example.com",
        name: "Pat Buyer",
        phone: "555-0100",
      },
      requestSnapshot: {
        source: "marketplace",
      },
    });

    expect(result).toMatchObject({
      ok: true,
      reusedCheckout: false,
      reusedPaymentAttempt: false,
      requiresPaymentLinkCreation: true,
      checkout: expect.objectContaining({
        currency: "USD",
        subtotalAmount: 14200,
        totalAmount: 14200,
      }),
      paymentAttempt: expect.objectContaining({
        expectedCurrency: "USD",
        expectedTotalAmount: 14200,
      }),
    });
    expect(txCheckoutCreate).toHaveBeenCalledTimes(1);
    expect(txCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          buyerEmail: "buyer@example.com",
          buyerName: "Pat Buyer",
          currency: "USD",
          subtotalAmount: 14200,
          totalAmount: 14200,
          items: {
            create: [
              expect.objectContaining({
                listingId: "listing-hoodie",
                variantId: "variant-hoodie-m",
                title: "Blarney Hoodie",
                unitAmount: 4500,
                totalAmount: 9000,
              }),
              expect.objectContaining({
                listingId: "listing-polo",
                variantId: "variant-polo-l",
                title: "Blarney Polo",
                unitAmount: 5200,
                totalAmount: 5200,
              }),
            ],
          },
        }),
      }),
    );
    expect(txPaymentAttemptCreate).toHaveBeenCalledTimes(1);
  });

  it("reuses an active pending checkout and payment attempt for the same logical request", async () => {
    txVariantFindMany.mockResolvedValue([buildVariant()]);
    txCheckoutFindFirst.mockResolvedValue(
      buildCheckoutState({
        items: [buildCheckoutState().items[0]],
        paymentAttempts: [
          buildPaymentAttempt({
            status: "OPEN",
            paymentUrl: "https://square.link/u/existing",
          }),
        ],
      }),
    );

    const result = await createOrReuseMarketplacePendingCheckout({
      items: [{ variantId: "variant-hoodie-m", quantity: 2 }],
      customer: {
        email: "buyer@example.com",
        name: "Pat Buyer",
        phone: "555-0100",
      },
      requestSnapshot: null,
    });

    expect(result).toMatchObject({
      ok: true,
      reusedCheckout: true,
      reusedPaymentAttempt: true,
      requiresPaymentLinkCreation: false,
      paymentAttempt: expect.objectContaining({
        status: "OPEN",
        paymentUrl: "https://square.link/u/existing",
      }),
    });
    expect(txCheckoutCreate).not.toHaveBeenCalled();
    expect(txPaymentAttemptCreate).not.toHaveBeenCalled();
  });

  it("rejects unavailable variants without persisting checkout state", async () => {
    txVariantFindMany.mockResolvedValue([]);

    await expect(
      createOrReuseMarketplacePendingCheckout({
        items: [{ variantId: "missing-variant", quantity: 1 }],
        customer: null,
        requestSnapshot: null,
      }),
    ).resolves.toEqual({
      ok: false,
      reason: "unavailable_items",
    });

    expect(txCheckoutCreate).not.toHaveBeenCalled();
    expect(txPaymentAttemptCreate).not.toHaveBeenCalled();
  });

  it("does not reuse expired pending checkouts", async () => {
    txVariantFindMany.mockResolvedValue([buildVariant()]);
    txCheckoutFindFirst.mockResolvedValue(
      buildCheckoutState({
        expiresAt: new Date("2026-05-18T12:00:00.000Z"),
        paymentAttempts: [
          buildPaymentAttempt({
            status: "OPEN",
            paymentUrl: "https://square.link/u/expired",
          }),
        ],
      }),
    );
    txCheckoutCreate.mockImplementation(async ({ data }) => ({
      ...buildCheckoutState({
        id: "checkout-2",
        idempotencyKey: data.idempotencyKey,
        publicTokenHash: data.publicTokenHash,
        snapshotHash: data.snapshotHash,
        buyerEmail: data.buyerEmail,
        buyerName: data.buyerName,
        currency: data.currency,
        subtotalAmount: data.subtotalAmount,
        taxAmount: data.taxAmount,
        shippingAmount: data.shippingAmount,
        discountAmount: data.discountAmount,
        totalAmount: data.totalAmount,
        requestSnapshot: data.requestSnapshot,
        customerSnapshot: data.customerSnapshot,
        expiresAt: data.expiresAt,
        items: data.items.create.map(
          (item: Record<string, unknown>, index: number) => ({
            id: `item-new-${index + 1}`,
            checkoutId: "checkout-2",
            createdAt: new Date("2026-05-19T12:00:00.000Z"),
            ...item,
          }),
        ),
        paymentAttempts: [],
      }),
    }));
    txPaymentAttemptCreate.mockImplementation(async ({ data }) =>
      buildPaymentAttempt({
        id: "attempt-2",
        checkoutId: data.checkoutId,
        idempotencyKey: data.idempotencyKey,
        expectedCurrency: data.expectedCurrency,
        expectedTotalAmount: data.expectedTotalAmount,
        expiresAt: data.expiresAt,
      }),
    );

    const result = await createOrReuseMarketplacePendingCheckout({
      items: [{ variantId: "variant-hoodie-m", quantity: 2 }],
      customer: {
        email: "buyer@example.com",
        name: "Pat Buyer",
        phone: "555-0100",
      },
      requestSnapshot: null,
    });

    expect(result).toMatchObject({
      ok: true,
      reusedCheckout: false,
      reusedPaymentAttempt: false,
      requiresPaymentLinkCreation: true,
    });
    expect(txCheckoutUpdateMany).toHaveBeenCalledTimes(1);
    expect(txCheckoutCreate).toHaveBeenCalledTimes(1);
    expect(txPaymentAttemptCreate).toHaveBeenCalledTimes(1);
  });

  it("reads a persisted pending checkout by id", async () => {
    readCheckoutFindUnique.mockResolvedValue(
      buildCheckoutState({
        paymentAttempts: [
          buildPaymentAttempt({ id: "attempt-completed", status: "COMPLETED" }),
          buildPaymentAttempt({
            id: "attempt-open",
            status: "OPEN",
            paymentUrl: "https://square.link/u/open",
          }),
        ],
      }),
    );

    await expect(
      getMarketplacePendingCheckout("checkout-1"),
    ).resolves.toMatchObject({
      ok: true,
      checkout: expect.objectContaining({ id: "checkout-1" }),
      paymentAttempt: expect.objectContaining({
        id: "attempt-open",
        status: "OPEN",
      }),
    });
  });

  it("returns expired for stale pending checkout reads", async () => {
    readCheckoutFindUnique.mockResolvedValue(
      buildCheckoutState({
        expiresAt: new Date("2026-05-18T12:00:00.000Z"),
      }),
    );

    await expect(getMarketplacePendingCheckout("checkout-1")).resolves.toEqual({
      ok: false,
      reason: "expired",
    });

    expect(readCheckoutUpdateMany).toHaveBeenCalledTimes(1);
  });

  it("creates a marketplace payment link for a persisted pending attempt", async () => {
    txVariantFindMany.mockResolvedValue([buildVariant()]);
    txCheckoutCreate.mockImplementation(async ({ data }) => ({
      ...buildCheckoutState({
        idempotencyKey: data.idempotencyKey,
        publicTokenHash: data.publicTokenHash,
        snapshotHash: data.snapshotHash,
        buyerEmail: data.buyerEmail,
        buyerName: data.buyerName,
        currency: data.currency,
        subtotalAmount: data.subtotalAmount,
        taxAmount: data.taxAmount,
        shippingAmount: data.shippingAmount,
        discountAmount: data.discountAmount,
        totalAmount: data.totalAmount,
        requestSnapshot: data.requestSnapshot,
        customerSnapshot: data.customerSnapshot,
        expiresAt: data.expiresAt,
        items: data.items.create.map(
          (item: Record<string, unknown>, index: number) => ({
            id: `item-${index + 1}`,
            checkoutId: "checkout-1",
            createdAt: new Date("2026-05-19T12:00:00.000Z"),
            ...item,
          }),
        ),
        paymentAttempts: [],
      }),
    }));
    txPaymentAttemptCreate.mockImplementation(async ({ data }) =>
      buildPaymentAttempt({
        id: "attempt-1",
        checkoutId: data.checkoutId,
        idempotencyKey: data.idempotencyKey,
        expectedCurrency: data.expectedCurrency,
        expectedTotalAmount: data.expectedTotalAmount,
        expiresAt: data.expiresAt,
      }),
    );

    await expect(
      createMarketplaceCheckoutPayment({
        items: [{ variantId: "variant-hoodie-m", quantity: 2 }],
        customer: {
          email: "buyer@example.com",
          name: "Pat Buyer",
          phone: "555-0100",
        },
        requestSnapshot: null,
      }),
    ).resolves.toMatchObject({
      ok: true,
      status: "pending",
      checkoutId: "checkout-1",
      paymentAttemptId: "attempt-1",
      paymentReference: "marketplace-payment-link-id",
      paymentUrl: "https://square.link/u/marketplace-payment",
    });

    expect(createMarketplacePaymentLink).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentAttemptId: "attempt-1",
        email: "buyer@example.com",
        currency: "USD",
        items: [
          expect.objectContaining({
            title: "Blarney Hoodie",
            variantLabel: "Medium",
            quantity: 2,
            unitAmount: 4500,
          }),
        ],
      }),
    );
    expect(txPaymentAttemptUpdateMany).toHaveBeenCalledTimes(1);
  });

  it("reuses an existing unpaid marketplace payment link from Square lookup", async () => {
    readCheckoutFindUnique.mockResolvedValue(
      buildCheckoutState({
        paymentAttempts: [
          buildPaymentAttempt({
            id: "attempt-open",
            status: "OPEN",
            providerLinkId: "marketplace-payment-link-id",
            paymentUrl: "https://square.link/u/existing",
          }),
        ],
      }),
    );
    getSquarePaymentLinkState.mockResolvedValue({
      reference: "marketplace-payment-link-id",
      orderId: "marketplace-order-123",
      url: "https://square.link/u/existing",
      orderState: "OPEN",
      isComplete: false,
    });

    await expect(
      getMarketplaceCheckoutPayment("checkout-1"),
    ).resolves.toMatchObject({
      ok: true,
      status: "pending",
      checkoutId: "checkout-1",
      paymentAttemptId: "attempt-open",
      paymentReference: "marketplace-payment-link-id",
      paymentUrl: "https://square.link/u/existing",
    });

    expect(createMarketplacePaymentLink).not.toHaveBeenCalled();
    expect(getSquarePaymentLinkState).toHaveBeenCalledWith(
      "marketplace-payment-link-id",
    );
  });

  it("creates a marketplace order when Square shows a marketplace link as already paid", async () => {
    readCheckoutFindUnique.mockResolvedValue(
      buildCheckoutState({
        paymentAttempts: [
          buildPaymentAttempt({
            id: "attempt-paid",
            status: "OPEN",
            providerLinkId: "marketplace-payment-link-id",
            paymentUrl: "https://square.link/u/existing",
          }),
        ],
      }),
    );
    getSquarePaymentLinkState.mockResolvedValue({
      reference: "marketplace-payment-link-id",
      orderId: "marketplace-order-123",
      url: "https://square.link/u/existing",
      orderState: "COMPLETED",
      isComplete: true,
    });
    txCheckoutFindUnique.mockResolvedValue(
      buildCheckoutState({
        paymentAttempts: [
          buildPaymentAttempt({
            id: "attempt-paid",
            status: "COMPLETED",
            providerLinkId: "marketplace-payment-link-id",
            providerOrderId: "marketplace-order-123",
            paymentUrl: "https://square.link/u/existing",
            completedAt: new Date("2026-05-19T12:30:00.000Z"),
          }),
        ],
      }),
    );

    await expect(getMarketplaceCheckoutPayment("checkout-1")).resolves.toEqual({
      ok: true,
      status: "confirmed",
      checkoutId: "checkout-1",
      orderId: "order-1",
      paymentUrl: null,
    });

    expect(txOrderCreate).toHaveBeenCalledTimes(1);
    expect(txCheckoutUpdateMany).toHaveBeenCalledTimes(1);
    expect(txPaymentAttemptUpdateMany).toHaveBeenCalledTimes(2);
    expect(createMarketplacePaymentLink).not.toHaveBeenCalled();
  });

  it("returns configuration when Square checkout settings are unavailable", async () => {
    hasSquareCheckoutConfiguration.mockReturnValue(false);
    readCheckoutFindUnique.mockResolvedValue(buildCheckoutState());

    await expect(getMarketplaceCheckoutPayment("checkout-1")).resolves.toEqual({
      ok: false,
      reason: "configuration",
    });

    expect(createMarketplacePaymentLink).not.toHaveBeenCalled();
    expect(getSquarePaymentLinkState).not.toHaveBeenCalled();
  });

  it("returns the existing marketplace order for repeated confirmed payment checks", async () => {
    readCheckoutFindUnique.mockResolvedValue(
      buildCheckoutState({
        status: "CONFIRMED",
        confirmedAt: new Date("2026-05-19T12:30:00.000Z"),
        paymentAttempts: [
          buildPaymentAttempt({
            id: "attempt-paid",
            status: "COMPLETED",
            providerLinkId: "marketplace-payment-link-id",
            providerOrderId: "marketplace-order-123",
            completedAt: new Date("2026-05-19T12:30:00.000Z"),
          }),
        ],
      }),
    );
    readOrderFindUnique.mockResolvedValue(buildOrder());

    await expect(getMarketplaceCheckoutPayment("checkout-1")).resolves.toEqual({
      ok: true,
      status: "confirmed",
      checkoutId: "checkout-1",
      orderId: "order-1",
      paymentUrl: null,
    });

    expect(getSquarePaymentLinkState).not.toHaveBeenCalled();
    expect(txOrderCreate).not.toHaveBeenCalled();
  });

  it("routes paid marketplace attempts with mismatched totals to review", async () => {
    readCheckoutFindUnique.mockResolvedValue(
      buildCheckoutState({
        paymentAttempts: [
          buildPaymentAttempt({
            id: "attempt-paid",
            status: "OPEN",
            providerLinkId: "marketplace-payment-link-id",
            providerOrderId: "marketplace-order-123",
            expectedTotalAmount: 15000,
            paymentUrl: "https://square.link/u/existing",
          }),
        ],
      }),
    );
    getSquarePaymentLinkState.mockResolvedValue({
      reference: "marketplace-payment-link-id",
      orderId: "marketplace-order-123",
      url: "https://square.link/u/existing",
      orderState: "COMPLETED",
      isComplete: true,
    });
    txCheckoutFindUnique.mockResolvedValue(
      buildCheckoutState({
        paymentAttempts: [
          buildPaymentAttempt({
            id: "attempt-paid",
            status: "COMPLETED",
            providerLinkId: "marketplace-payment-link-id",
            providerOrderId: "marketplace-order-123",
            expectedTotalAmount: 15000,
            paymentUrl: "https://square.link/u/existing",
            completedAt: new Date("2026-05-19T12:30:00.000Z"),
          }),
        ],
      }),
    );

    await expect(getMarketplaceCheckoutPayment("checkout-1")).resolves.toEqual({
      ok: false,
      reason: "review",
    });

    expect(txOrderCreate).not.toHaveBeenCalled();
    expect(txCheckoutUpdateMany).toHaveBeenCalledTimes(1);
    expect(txPaymentAttemptUpdateMany).toHaveBeenCalledTimes(2);
  });

  it("finalizes a marketplace payment by provider order id", async () => {
    txPaymentAttemptFindUnique.mockResolvedValue(
      buildPaymentAttempt({
        id: "attempt-paid",
        status: "COMPLETED",
        providerLinkId: "marketplace-payment-link-id",
        providerOrderId: "marketplace-order-123",
        completedAt: new Date("2026-05-19T12:30:00.000Z"),
      }),
    );
    txCheckoutFindUnique.mockResolvedValue(
      buildCheckoutState({
        paymentAttempts: [
          buildPaymentAttempt({
            id: "attempt-paid",
            status: "COMPLETED",
            providerLinkId: "marketplace-payment-link-id",
            providerOrderId: "marketplace-order-123",
            completedAt: new Date("2026-05-19T12:30:00.000Z"),
          }),
        ],
      }),
    );

    await expect(
      confirmMarketplaceCheckoutPaymentByOrderId("marketplace-order-123"),
    ).resolves.toEqual({
      ok: true,
      status: "confirmed",
      checkoutId: "checkout-1",
      orderId: "order-1",
      paymentUrl: null,
    });

    expect(txOrderCreate).toHaveBeenCalledTimes(1);
    expect(getSquarePaymentLinkState).not.toHaveBeenCalled();
  });

  it("returns the persisted marketplace link when payment-link persistence loses a race", async () => {
    txVariantFindMany.mockResolvedValue([buildVariant()]);
    txCheckoutCreate.mockImplementation(async ({ data }) => ({
      ...buildCheckoutState({
        idempotencyKey: data.idempotencyKey,
        publicTokenHash: data.publicTokenHash,
        snapshotHash: data.snapshotHash,
        buyerEmail: data.buyerEmail,
        buyerName: data.buyerName,
        currency: data.currency,
        subtotalAmount: data.subtotalAmount,
        taxAmount: data.taxAmount,
        shippingAmount: data.shippingAmount,
        discountAmount: data.discountAmount,
        totalAmount: data.totalAmount,
        requestSnapshot: data.requestSnapshot,
        customerSnapshot: data.customerSnapshot,
        expiresAt: data.expiresAt,
        items: data.items.create.map(
          (item: Record<string, unknown>, index: number) => ({
            id: `item-${index + 1}`,
            checkoutId: "checkout-1",
            createdAt: new Date("2026-05-19T12:00:00.000Z"),
            ...item,
          }),
        ),
        paymentAttempts: [],
      }),
    }));
    txPaymentAttemptCreate.mockImplementation(async ({ data }) =>
      buildPaymentAttempt({
        id: "attempt-1",
        checkoutId: data.checkoutId,
        idempotencyKey: data.idempotencyKey,
        expectedCurrency: data.expectedCurrency,
        expectedTotalAmount: data.expectedTotalAmount,
        expiresAt: data.expiresAt,
      }),
    );
    txPaymentAttemptUpdateMany.mockResolvedValue({ count: 0 });
    txPaymentAttemptFindUnique.mockResolvedValue(
      buildPaymentAttempt({
        id: "attempt-1",
        status: "OPEN",
        providerLinkId: "persisted-marketplace-link-id",
        paymentUrl: "https://square.link/u/persisted-marketplace-payment",
      }),
    );
    createMarketplacePaymentLink.mockResolvedValue({
      reference: "created-marketplace-link-id",
      orderId: "marketplace-order-123",
      url: "https://square.link/u/created-marketplace-payment",
    });

    await expect(
      createMarketplaceCheckoutPayment({
        items: [{ variantId: "variant-hoodie-m", quantity: 2 }],
        customer: {
          email: "buyer@example.com",
          name: "Pat Buyer",
          phone: "555-0100",
        },
        requestSnapshot: null,
      }),
    ).resolves.toMatchObject({
      ok: true,
      status: "pending",
      paymentReference: "persisted-marketplace-link-id",
      paymentUrl: "https://square.link/u/persisted-marketplace-payment",
    });
  });

  it("sanitizes marketplace payment provider failures", async () => {
    txVariantFindMany.mockResolvedValue([buildVariant()]);
    txCheckoutCreate.mockImplementation(async ({ data }) => ({
      ...buildCheckoutState({
        idempotencyKey: data.idempotencyKey,
        publicTokenHash: data.publicTokenHash,
        snapshotHash: data.snapshotHash,
        buyerEmail: data.buyerEmail,
        buyerName: data.buyerName,
        currency: data.currency,
        subtotalAmount: data.subtotalAmount,
        taxAmount: data.taxAmount,
        shippingAmount: data.shippingAmount,
        discountAmount: data.discountAmount,
        totalAmount: data.totalAmount,
        requestSnapshot: data.requestSnapshot,
        customerSnapshot: data.customerSnapshot,
        expiresAt: data.expiresAt,
        items: data.items.create.map(
          (item: Record<string, unknown>, index: number) => ({
            id: `item-${index + 1}`,
            checkoutId: "checkout-1",
            createdAt: new Date("2026-05-19T12:00:00.000Z"),
            ...item,
          }),
        ),
        paymentAttempts: [],
      }),
    }));
    txPaymentAttemptCreate.mockImplementation(async ({ data }) =>
      buildPaymentAttempt({
        id: "attempt-1",
        checkoutId: data.checkoutId,
        idempotencyKey: data.idempotencyKey,
        expectedCurrency: data.expectedCurrency,
        expectedTotalAmount: data.expectedTotalAmount,
        expiresAt: data.expiresAt,
      }),
    );
    createMarketplacePaymentLink.mockRejectedValue(
      new Error("Square upstream timeout"),
    );

    await expect(
      createMarketplaceCheckoutPayment({
        items: [{ variantId: "variant-hoodie-m", quantity: 2 }],
        customer: {
          email: "buyer@example.com",
          name: "Pat Buyer",
          phone: "555-0100",
        },
        requestSnapshot: null,
      }),
    ).resolves.toEqual({
      ok: false,
      reason: "unavailable",
    });
  });

  it("decrements inventory for each checkout item with a variantId when an order is confirmed", async () => {
    txPaymentAttemptFindUnique.mockResolvedValue(
      buildPaymentAttempt({
        id: "attempt-paid",
        status: "COMPLETED",
        providerLinkId: "marketplace-payment-link-id",
        providerOrderId: "marketplace-order-123",
        completedAt: new Date("2026-05-19T12:30:00.000Z"),
      }),
    );
    txCheckoutFindUnique.mockResolvedValue(
      buildCheckoutState({
        paymentAttempts: [
          buildPaymentAttempt({
            id: "attempt-paid",
            status: "COMPLETED",
            providerLinkId: "marketplace-payment-link-id",
            providerOrderId: "marketplace-order-123",
            completedAt: new Date("2026-05-19T12:30:00.000Z"),
          }),
        ],
      }),
    );

    await expect(
      confirmMarketplaceCheckoutPaymentByOrderId("marketplace-order-123"),
    ).resolves.toEqual({
      ok: true,
      status: "confirmed",
      checkoutId: "checkout-1",
      orderId: "order-1",
      paymentUrl: null,
    });

    expect(txListingVariantUpdateMany).toHaveBeenCalledTimes(2);
    expect(txListingVariantUpdateMany).toHaveBeenNthCalledWith(1, {
      where: {
        id: "variant-hoodie-m",
        inventoryQuantity: { not: null, gte: 2 },
      },
      data: { inventoryQuantity: { decrement: 2 } },
    });
    expect(txListingVariantUpdateMany).toHaveBeenNthCalledWith(2, {
      where: {
        id: "variant-polo-l",
        inventoryQuantity: { not: null, gte: 1 },
      },
      data: { inventoryQuantity: { decrement: 1 } },
    });
  });

  it("skips inventory decrement for checkout items where variantId is null", async () => {
    txPaymentAttemptFindUnique.mockResolvedValue(
      buildPaymentAttempt({
        id: "attempt-paid",
        status: "COMPLETED",
        providerLinkId: "marketplace-payment-link-id",
        providerOrderId: "marketplace-order-123",
        completedAt: new Date("2026-05-19T12:30:00.000Z"),
      }),
    );
    txCheckoutFindUnique.mockResolvedValue(
      buildCheckoutState({
        items: [
          {
            id: "item-no-variant",
            checkoutId: "checkout-1",
            listingId: "listing-hoodie",
            variantId: null,
            lineNumber: 1,
            title: "Blarney Hoodie",
            variantLabel: "One Size",
            sku: "HOODIE-OS",
            quantity: 1,
            currency: "USD",
            unitAmount: 4500,
            totalAmount: 4500,
            detailSnapshot: {
              slug: "hoodie",
              description: "Warm layer",
              imageUrl: "/images/hoodie.jpg",
              fulfillmentNote: null,
            },
            createdAt: new Date("2026-05-19T12:00:00.000Z"),
          },
        ],
        paymentAttempts: [
          buildPaymentAttempt({
            id: "attempt-paid",
            status: "COMPLETED",
            providerLinkId: "marketplace-payment-link-id",
            providerOrderId: "marketplace-order-123",
            expectedTotalAmount: 4500,
            completedAt: new Date("2026-05-19T12:30:00.000Z"),
          }),
        ],
        subtotalAmount: 4500,
        totalAmount: 4500,
      }),
    );
    txOrderCreate.mockResolvedValue(buildOrder({ totalAmount: 4500 }));

    await confirmMarketplaceCheckoutPaymentByOrderId("marketplace-order-123");

    expect(txListingVariantUpdateMany).not.toHaveBeenCalled();
  });

  it("does not call inventory decrement when the checkout already has an order (idempotency early-return path)", async () => {
    txPaymentAttemptFindUnique.mockResolvedValue(
      buildPaymentAttempt({
        id: "attempt-paid",
        status: "COMPLETED",
        providerLinkId: "marketplace-payment-link-id",
        providerOrderId: "marketplace-order-123",
        completedAt: new Date("2026-05-19T12:30:00.000Z"),
      }),
    );
    txCheckoutFindUnique.mockResolvedValue(
      buildCheckoutState({
        status: "CONFIRMED",
        confirmedAt: new Date("2026-05-19T12:30:00.000Z"),
        order: buildOrder(),
        paymentAttempts: [
          buildPaymentAttempt({
            id: "attempt-paid",
            status: "COMPLETED",
            providerLinkId: "marketplace-payment-link-id",
            providerOrderId: "marketplace-order-123",
            completedAt: new Date("2026-05-19T12:30:00.000Z"),
          }),
        ],
      }),
    );

    await expect(
      confirmMarketplaceCheckoutPaymentByOrderId("marketplace-order-123"),
    ).resolves.toEqual({
      ok: true,
      status: "confirmed",
      checkoutId: "checkout-1",
      orderId: "order-1",
      paymentUrl: null,
    });

    expect(txListingVariantUpdateMany).not.toHaveBeenCalled();
    expect(txOrderCreate).not.toHaveBeenCalled();
  });
});
