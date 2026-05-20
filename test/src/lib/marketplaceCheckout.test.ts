import {
  buildMarketplaceCheckoutDraft,
  getMarketplaceCheckoutIdempotencyKey,
} from "@/lib/marketplaceCheckout";
import { describe, expect, it } from "vitest";

describe("marketplace checkout foundation", () => {
  it("builds immutable checkout snapshots from priced items", () => {
    const input = {
      items: [
        {
          productId: "product-hoodie",
          variantId: "variant-hoodie-m",
          title: "Blarney Hoodie",
          variantLabel: "Medium",
          sku: "HOODIE-M",
          quantity: 2,
          currency: "usd",
          unitAmount: 4500,
          detailSnapshot: {
            imageUrl: "/images/hoodie.jpg",
            options: {
              size: "M",
            },
          },
        },
        {
          productId: "product-polo",
          variantId: "variant-polo-l",
          title: "Blarney Polo",
          variantLabel: "Large",
          sku: "POLO-L",
          quantity: 1,
          currency: "usd",
          unitAmount: 5200,
          detailSnapshot: {
            imageUrl: "/images/polo.jpg",
            options: {
              size: "L",
            },
          },
        },
      ],
      customer: {
        email: "Buyer@Example.com",
        name: "Pat Buyer",
        phone: "555-0100",
      },
      requestSnapshot: {
        source: "marketplace",
      },
      taxAmount: 350,
      shippingAmount: 0,
      discountAmount: 500,
    };

    const draft = buildMarketplaceCheckoutDraft(input);

    expect(draft.totals).toEqual({
      currency: "USD",
      subtotalAmount: 14200,
      taxAmount: 350,
      shippingAmount: 0,
      discountAmount: 500,
      totalAmount: 14050,
    });
    expect(draft.snapshotHash).toMatch(/^[a-f0-9]{64}$/i);
    expect(draft.customerSnapshot).toEqual({
      email: "buyer@example.com",
      name: "Pat Buyer",
      phone: "555-0100",
    });
    expect(draft.items).toEqual([
      expect.objectContaining({
        lineNumber: 1,
        variantId: "variant-hoodie-m",
        totalAmount: 9000,
      }),
      expect.objectContaining({
        lineNumber: 2,
        variantId: "variant-polo-l",
        totalAmount: 5200,
      }),
    ]);

    input.items[0].detailSnapshot.options.size = "XL";
    input.customer.email = "changed@example.com";
    input.requestSnapshot.source = "mutated";

    expect(draft.items[0]?.detailSnapshot).toEqual({
      imageUrl: "/images/hoodie.jpg",
      options: {
        size: "M",
      },
    });
    expect(draft.customerSnapshot?.email).toBe("buyer@example.com");
    expect(draft.requestSnapshot).toEqual({ source: "marketplace" });
  });

  it("derives a stable idempotency key from canonicalized request input", () => {
    const firstKey = getMarketplaceCheckoutIdempotencyKey({
      items: [
        {
          variantId: "variant-polo-l",
          quantity: 1,
        },
        {
          variantId: "variant-hoodie-m",
          quantity: 2,
        },
      ],
      customer: {
        email: "Buyer@Example.com",
      },
      requestSnapshot: null,
    });

    const secondKey = getMarketplaceCheckoutIdempotencyKey({
      items: [
        {
          variantId: "variant-hoodie-m",
          quantity: 2,
        },
        {
          variantId: "variant-polo-l",
          quantity: 1,
        },
      ],
      customer: {
        email: "buyer@example.com",
      },
      requestSnapshot: null,
    });

    expect(firstKey).toBe(secondKey);
  });

  it("rejects mixed-currency checkout drafts", () => {
    expect(() =>
      buildMarketplaceCheckoutDraft({
        items: [
          {
            productId: "product-hoodie",
            variantId: "variant-hoodie-m",
            title: "Blarney Hoodie",
            variantLabel: "Medium",
            sku: "HOODIE-M",
            quantity: 1,
            currency: "USD",
            unitAmount: 4500,
            detailSnapshot: {
              size: "M",
            },
          },
          {
            productId: "product-polo",
            variantId: "variant-polo-l",
            title: "Blarney Polo",
            variantLabel: "Large",
            sku: "POLO-L",
            quantity: 1,
            currency: "CAD",
            unitAmount: 5200,
            detailSnapshot: {
              size: "L",
            },
          },
        ],
      }),
    ).toThrow("Marketplace checkout items must use a single currency.");
  });
});
