import { afterEach, describe, expect, it, vi } from "vitest";

const { listingFindMany, variantFindMany } = vi.hoisted(() => ({
  listingFindMany: vi.fn(),
  variantFindMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    marketplaceListing: {
      findMany: listingFindMany,
    },
    marketplaceListingVariant: {
      findMany: variantFindMany,
    },
  },
}));

import { getMarketplaceCatalog } from "@/lib/marketplaceCatalog";

afterEach(() => {
  vi.clearAllMocks();
});

describe("marketplace catalog service", () => {
  it("reads only active listings with active purchasable variants", async () => {
    listingFindMany.mockResolvedValue([
      {
        id: "listing-hoodie",
        slug: "hoodie",
        title: "Blarney Hoodie",
        description: "Warm layer",
        imageUrl: "/images/hoodie.jpg",
        fulfillmentNote: "Pickup at check-in",
        sortOrder: 1,
        variants: [
          {
            id: "variant-hoodie-m",
            label: "Medium",
            sku: "HOODIE-M",
            unitAmount: 4500,
            currency: "USD",
            inventoryQuantity: null,
          },
        ],
      },
    ]);

    await expect(getMarketplaceCatalog()).resolves.toEqual([
      expect.objectContaining({
        id: "listing-hoodie",
        slug: "hoodie",
        variants: [
          expect.objectContaining({
            id: "variant-hoodie-m",
            unitAmount: 4500,
            currency: "USD",
          }),
        ],
      }),
    ]);

    expect(listingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: "ACTIVE",
          variants: {
            some: {
              isActive: true,
              OR: [
                { inventoryQuantity: null },
                { inventoryQuantity: { gt: 0 } },
              ],
            },
          },
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      }),
    );
  });
});
