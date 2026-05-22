import {
  getChairMarketplaceOverview,
  updateMarketplaceOrderFulfillmentStatus,
} from "@/lib/marketplaceChair";
import { afterEach, describe, expect, it, vi } from "vitest";

const {
  checkoutCount,
  checkoutFindMany,
  orderCount,
  orderFindMany,
  orderFindUnique,
  orderUpdateMany,
} = vi.hoisted(() => ({
  checkoutCount: vi.fn(),
  checkoutFindMany: vi.fn(),
  orderCount: vi.fn(),
  orderFindMany: vi.fn(),
  orderFindUnique: vi.fn(),
  orderUpdateMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    marketplaceCheckout: {
      count: checkoutCount,
      findMany: checkoutFindMany,
    },
    marketplaceOrder: {
      count: orderCount,
      findMany: orderFindMany,
      findUnique: orderFindUnique,
      updateMany: orderUpdateMany,
    },
  },
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("marketplace chair service", () => {
  it("maps marketplace review and fulfillment queues into a chair-friendly overview", async () => {
    checkoutCount.mockResolvedValue(1);
    orderCount.mockImplementation(async (args) => {
      switch (args.where.fulfillmentStatus) {
        case "UNFULFILLED":
          return 2;
        case "READY":
          return 1;
        case "FULFILLED":
          return 4;
        default:
          return 0;
      }
    });
    checkoutFindMany.mockResolvedValue([
      {
        id: "checkout-1",
        buyerEmail: "buyer@example.com",
        buyerName: "Pat Buyer",
        status: "PAYMENT_REVIEW",
        currency: "USD",
        totalAmount: 9000,
        customerSnapshot: {
          email: "buyer@example.com",
          name: "Pat Buyer",
          phone: "555-0100",
        },
        expiresAt: new Date("2026-05-21T12:00:00.000Z"),
        createdAt: new Date("2026-05-20T11:00:00.000Z"),
        items: [
          {
            id: "checkout-item-1",
            title: "Blarney Hoodie",
            variantLabel: "Medium",
            quantity: 2,
            currency: "USD",
            totalAmount: 9000,
            detailSnapshot: {
              fulfillmentNote: "Pickup at check-in",
            },
          },
        ],
        paymentAttempts: [
          {
            id: "attempt-1",
            status: "REVIEW",
            providerLinkId: "marketplace-link-1",
            providerOrderId: "marketplace-order-1",
            createdAt: new Date("2026-05-20T11:05:00.000Z"),
            completedAt: null,
            lastReconciledAt: new Date("2026-05-20T11:06:00.000Z"),
          },
        ],
      },
    ]);
    orderFindMany.mockImplementation(async (args) => {
      if ("in" in args.where.fulfillmentStatus) {
        return [
          {
            id: "order-1",
            checkoutId: "checkout-1",
            buyerEmail: "buyer@example.com",
            buyerName: "Pat Buyer",
            currency: "USD",
            totalAmount: 9000,
            customerSnapshot: {
              email: "buyer@example.com",
              name: "Pat Buyer",
              phone: "555-0100",
            },
            providerOrderId: "marketplace-order-1",
            fulfillmentStatus: "UNFULFILLED",
            confirmedAt: new Date("2026-05-20T12:00:00.000Z"),
            updatedAt: new Date("2026-05-20T12:00:00.000Z"),
            items: [
              {
                id: "order-item-1",
                title: "Blarney Hoodie",
                variantLabel: "Medium",
                quantity: 2,
                currency: "USD",
                totalAmount: 9000,
                detailSnapshot: {
                  fulfillmentNote: "Pickup at check-in",
                },
              },
            ],
          },
        ];
      }

      return [
        {
          id: "order-2",
          checkoutId: "checkout-2",
          buyerEmail: "recent@example.com",
          buyerName: "Recent Buyer",
          currency: "USD",
          totalAmount: 4500,
          customerSnapshot: {
            email: "recent@example.com",
            name: "Recent Buyer",
            phone: null,
          },
          providerOrderId: "marketplace-order-2",
          fulfillmentStatus: "FULFILLED",
          confirmedAt: new Date("2026-05-20T09:00:00.000Z"),
          updatedAt: new Date("2026-05-20T10:00:00.000Z"),
          items: [
            {
              id: "order-item-2",
              title: "Blarney Polo",
              variantLabel: "Large",
              quantity: 1,
              currency: "USD",
              totalAmount: 4500,
              detailSnapshot: {},
            },
          ],
        },
      ];
    });

    await expect(getChairMarketplaceOverview()).resolves.toEqual({
      counts: {
        review: 1,
        unfulfilled: 2,
        ready: 1,
        fulfilled: 4,
      },
      reviewQueue: [
        expect.objectContaining({
          id: "checkout-1",
          phone: "555-0100",
          paymentStatus: "REVIEW",
          paymentReference: "marketplace-link-1",
          providerOrderId: "marketplace-order-1",
          itemCount: 2,
          items: [
            expect.objectContaining({
              title: "Blarney Hoodie",
              fulfillmentNote: "Pickup at check-in",
            }),
          ],
        }),
      ],
      activeOrders: [
        expect.objectContaining({
          id: "order-1",
          fulfillmentStatus: "UNFULFILLED",
          phone: "555-0100",
          itemCount: 2,
        }),
      ],
      recentFulfilledOrders: [
        expect.objectContaining({
          id: "order-2",
          fulfillmentStatus: "FULFILLED",
        }),
      ],
    });
  });

  it("moves an unfulfilled order to ready", async () => {
    orderFindUnique
      .mockResolvedValueOnce({
        id: "order-1",
        fulfillmentStatus: "UNFULFILLED",
      })
      .mockResolvedValueOnce({
        id: "order-1",
        fulfillmentStatus: "READY",
      });
    orderUpdateMany.mockResolvedValue({ count: 1 });

    await expect(
      updateMarketplaceOrderFulfillmentStatus({
        orderId: "order-1",
        nextStatus: "READY",
      }),
    ).resolves.toEqual({
      ok: true,
      orderId: "order-1",
      status: "READY",
    });

    expect(orderUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "order-1",
        fulfillmentStatus: "UNFULFILLED",
      },
      data: {
        fulfillmentStatus: "READY",
      },
    });
  });

  it("rejects skipping straight from unfulfilled to fulfilled", async () => {
    orderFindUnique.mockResolvedValue({
      id: "order-1",
      fulfillmentStatus: "UNFULFILLED",
    });

    await expect(
      updateMarketplaceOrderFulfillmentStatus({
        orderId: "order-1",
        nextStatus: "FULFILLED",
      }),
    ).resolves.toEqual({
      ok: false,
      reason: "invalid_transition",
    });

    expect(orderUpdateMany).not.toHaveBeenCalled();
  });

  it("returns not_found when the order is missing", async () => {
    orderFindUnique.mockResolvedValue(null);

    await expect(
      updateMarketplaceOrderFulfillmentStatus({
        orderId: "order-missing",
        nextStatus: "READY",
      }),
    ).resolves.toEqual({
      ok: false,
      reason: "not_found",
    });
  });
});
