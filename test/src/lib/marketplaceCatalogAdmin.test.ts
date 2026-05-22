import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  deletePhotoObject,
  dbTransaction,
  listingCreate,
  listingDeleteMany,
  listingFindMany,
  listingFindUnique,
  listingUpdate,
  variantCount,
  variantCreate,
  variantDeleteMany,
  variantFindUnique,
  variantUpdate,
} = vi.hoisted(() => ({
  deletePhotoObject: vi.fn(),
  dbTransaction: vi.fn(),
  listingCreate: vi.fn(),
  listingDeleteMany: vi.fn(),
  listingFindMany: vi.fn(),
  listingFindUnique: vi.fn(),
  listingUpdate: vi.fn(),
  variantCount: vi.fn(),
  variantCreate: vi.fn(),
  variantDeleteMany: vi.fn(),
  variantFindUnique: vi.fn(),
  variantUpdate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: dbTransaction,
    marketplaceListing: {
      create: listingCreate,
      deleteMany: listingDeleteMany,
      findMany: listingFindMany,
      findUnique: listingFindUnique,
      update: listingUpdate,
    },
    marketplaceListingVariant: {
      count: variantCount,
      create: variantCreate,
      deleteMany: variantDeleteMany,
      findUnique: variantFindUnique,
      update: variantUpdate,
    },
  },
}));

vi.mock("@/lib/s3", () => ({
  deletePhotoObject,
}));

import {
  archiveMarketplaceListing,
  createMarketplaceListing,
  createMarketplaceListingVariant,
  deleteArchivedMarketplaceListing,
  getChairMarketplaceCatalog,
  publishMarketplaceListing,
  restoreMarketplaceListing,
  saveMarketplaceListing,
  updateMarketplaceListing,
  updateMarketplaceListingVariant,
} from "@/lib/marketplaceCatalogAdmin";

beforeEach(() => {
  dbTransaction.mockImplementation((input) => {
    if (typeof input === "function") {
      return input({
        marketplaceListing: {
          deleteMany: listingDeleteMany,
          findUnique: listingFindUnique,
          update: listingUpdate,
        },
        marketplaceListingVariant: {
          create: variantCreate,
          count: variantCount,
          deleteMany: variantDeleteMany,
          findUnique: variantFindUnique,
          update: variantUpdate,
        },
      });
    }

    return Promise.all(input);
  });

  listingFindMany.mockResolvedValue([]);
  listingCreate.mockResolvedValue({ id: "listing-1" });
  listingDeleteMany.mockResolvedValue({ count: 1 });
  listingFindUnique.mockResolvedValue({
    id: "listing-1",
    imageUrl: null,
    status: "DRAFT",
  });
  listingUpdate.mockResolvedValue({ id: "listing-1", status: "DRAFT" });
  variantCount.mockResolvedValue(1);
  variantCreate.mockResolvedValue({ id: "variant-1" });
  variantDeleteMany.mockResolvedValue({ count: 0 });
  variantFindUnique.mockResolvedValue({
    id: "variant-1",
    listing: { status: "DRAFT" },
  });
  variantUpdate.mockResolvedValue({ id: "variant-1" });
  deletePhotoObject.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("marketplace catalog admin service", () => {
  it("reads listings with all variants for the chair catalog view", async () => {
    listingFindMany.mockResolvedValue([
      {
        id: "listing-1",
        slug: "hoodie",
        title: "Blarney Hoodie",
        description: "Heavy fleece",
        imageUrl: "/images/hoodie.jpg",
        fulfillmentNote: "Pickup at check-in",
        status: "ACTIVE",
        sortOrder: 1,
        createdAt: new Date("2026-05-20T12:00:00.000Z"),
        updatedAt: new Date("2026-05-20T12:00:00.000Z"),
        variants: [
          {
            id: "variant-1",
            label: "Medium",
            sku: "HOODIE-M",
            unitAmount: 4500,
            currency: "USD",
            inventoryQuantity: 8,
            isActive: true,
            sortOrder: 1,
            createdAt: new Date("2026-05-20T12:00:00.000Z"),
            updatedAt: new Date("2026-05-20T12:00:00.000Z"),
          },
        ],
      },
    ]);

    await expect(getChairMarketplaceCatalog()).resolves.toEqual([
      expect.objectContaining({
        id: "listing-1",
        slug: "hoodie",
        status: "ACTIVE",
        variants: [
          expect.objectContaining({ id: "variant-1", isActive: true }),
        ],
      }),
    ]);

    expect(listingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: expect.objectContaining({
          slug: true,
          status: true,
          variants: expect.objectContaining({
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          }),
        }),
      }),
    );
  });

  it("creates draft listings with normalized slugs", async () => {
    await expect(
      createMarketplaceListing({
        slug: " HoodIe-Drop ",
        title: " Blarney Hoodie ",
        description: "Warm layer",
        imageUrl: "listing/123e4567-e89b-12d3-a456-426614174000-hoodie.png",
        fulfillmentNote: "Pickup at check-in",
        sortOrder: "4",
      }),
    ).resolves.toEqual({
      ok: true,
      entityId: "listing-1",
      revalidatePublicCatalog: false,
    });

    expect(listingCreate).toHaveBeenCalledWith({
      data: {
        slug: "hoodie-drop",
        title: "Blarney Hoodie",
        description: "Warm layer",
        imageUrl: "listing/123e4567-e89b-12d3-a456-426614174000-hoodie.png",
        fulfillmentNote: "Pickup at check-in",
        sortOrder: 4,
        status: "DRAFT",
      },
      select: { id: true },
    });
  });

  it("rejects new draft listings that still submit a freeform image url", async () => {
    await expect(
      createMarketplaceListing({
        slug: "hoodie-drop",
        title: "Blarney Hoodie",
        description: "Warm layer",
        imageUrl: "/images/hoodie.jpg",
        fulfillmentNote: "Pickup at check-in",
        sortOrder: "4",
      }),
    ).resolves.toEqual({
      ok: false,
      reason: "invalid",
    });

    expect(listingCreate).not.toHaveBeenCalled();
  });

  it("rejects new draft listings that submit a non-listing S3 key", async () => {
    await expect(
      createMarketplaceListing({
        slug: "hoodie-drop",
        title: "Blarney Hoodie",
        description: "Warm layer",
        imageUrl: "pending/hoodie.png",
        fulfillmentNote: "Pickup at check-in",
        sortOrder: "4",
      }),
    ).resolves.toEqual({
      ok: false,
      reason: "invalid",
    });

    expect(listingCreate).not.toHaveBeenCalled();
  });

  it("blocks publishing listings that do not have any active variants", async () => {
    variantCount.mockResolvedValue(0);

    await expect(
      publishMarketplaceListing({
        listingId: "listing-1",
      }),
    ).resolves.toEqual({
      ok: false,
      reason: "requires_active_variant",
    });

    expect(listingUpdate).not.toHaveBeenCalled();
  });

  it("archives active listings and flags the public catalog for revalidation", async () => {
    listingFindUnique.mockResolvedValue({ id: "listing-1", status: "ACTIVE" });

    await expect(
      archiveMarketplaceListing({
        listingId: "listing-1",
      }),
    ).resolves.toEqual({
      ok: true,
      entityId: "listing-1",
      revalidatePublicCatalog: true,
      status: "ARCHIVED",
    });

    expect(listingUpdate).toHaveBeenCalledWith({
      where: { id: "listing-1" },
      data: { status: "ARCHIVED" },
    });
  });

  it("restores archived listings back to draft without revalidating the public catalog", async () => {
    listingFindUnique.mockResolvedValue({
      id: "listing-1",
      status: "ARCHIVED",
    });

    await expect(
      restoreMarketplaceListing({
        listingId: "listing-1",
      }),
    ).resolves.toEqual({
      ok: true,
      entityId: "listing-1",
      revalidatePublicCatalog: false,
      status: "DRAFT",
    });

    expect(listingUpdate).toHaveBeenCalledWith({
      where: { id: "listing-1" },
      data: { status: "DRAFT" },
    });
  });

  it("deletes archived listings and their managed S3 image", async () => {
    listingFindUnique.mockResolvedValue({
      id: "listing-1",
      imageUrl: "listing/123e4567-e89b-12d3-a456-426614174000-hoodie.png",
      status: "ARCHIVED",
    });

    await expect(
      deleteArchivedMarketplaceListing({
        listingId: "listing-1",
      }),
    ).resolves.toEqual({
      ok: true,
      entityId: "listing-1",
      revalidatePublicCatalog: false,
    });

    expect(listingDeleteMany).toHaveBeenCalledWith({
      where: {
        id: "listing-1",
        status: "ARCHIVED",
      },
    });
    expect(deletePhotoObject).toHaveBeenCalledWith(
      "listing/123e4567-e89b-12d3-a456-426614174000-hoodie.png",
    );
  });

  it("rejects deletion for listings that are not archived", async () => {
    listingFindUnique.mockResolvedValue({
      id: "listing-1",
      imageUrl: "listing/123e4567-e89b-12d3-a456-426614174000-cap.png",
      status: "DRAFT",
    });
    listingDeleteMany.mockResolvedValue({ count: 0 });

    await expect(
      deleteArchivedMarketplaceListing({
        listingId: "listing-1",
      }),
    ).resolves.toEqual({
      ok: false,
      reason: "invalid",
    });

    expect(deletePhotoObject).not.toHaveBeenCalled();
  });

  it("keeps the delete successful when managed image cleanup fails after the row is removed", async () => {
    const warnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    listingFindUnique.mockResolvedValue({
      id: "listing-1",
      imageUrl: "listing/123e4567-e89b-12d3-a456-426614174000-hoodie.png",
      status: "ARCHIVED",
    });
    deletePhotoObject.mockRejectedValueOnce(new Error("s3 unavailable"));

    await expect(
      deleteArchivedMarketplaceListing({
        listingId: "listing-1",
      }),
    ).resolves.toEqual({
      ok: true,
      entityId: "listing-1",
      revalidatePublicCatalog: false,
    });

    expect(warnSpy).toHaveBeenCalledWith(
      "[marketplace-catalog] listing-image-delete-failed",
      expect.objectContaining({
        imageKey: "listing/123e4567-e89b-12d3-a456-426614174000-hoodie.png",
        listingId: "listing-1",
        message: "s3 unavailable",
      }),
    );

    warnSpy.mockRestore();
  });

  it("maps duplicate variant sku conflicts to a safe result", async () => {
    variantUpdate.mockRejectedValue({
      code: "P2002",
      meta: { target: ["sku"] },
    });

    await expect(
      updateMarketplaceListingVariant({
        variantId: "variant-1",
        listingId: "listing-1",
        label: "Medium",
        sku: "HOODIE-M",
        unitAmount: "4500",
        currency: "usd",
        inventoryQuantity: "8",
        isActive: "true",
        sortOrder: "1",
      }),
    ).resolves.toEqual({
      ok: false,
      reason: "duplicate_sku",
    });
  });

  it("rejects listing edits for archived listings", async () => {
    listingFindUnique.mockResolvedValue({
      id: "listing-1",
      imageUrl: "/images/cap.jpg",
      status: "ARCHIVED",
    });

    await expect(
      updateMarketplaceListing({
        listingId: "listing-1",
        slug: "retired-cap",
        title: "Retired Cap",
        description: "Reference item",
        imageUrl: "/images/cap.jpg",
        fulfillmentNote: "No longer sold",
        sortOrder: "3",
      }),
    ).resolves.toEqual({
      ok: false,
      reason: "invalid",
    });

    expect(listingUpdate).not.toHaveBeenCalled();
  });

  it("allows draft listings to keep a previously saved legacy image reference", async () => {
    listingFindUnique.mockResolvedValue({
      id: "listing-1",
      imageUrl: "/images/cap.jpg",
      status: "DRAFT",
    });
    listingUpdate.mockResolvedValue({ id: "listing-1", status: "DRAFT" });

    await expect(
      updateMarketplaceListing({
        listingId: "listing-1",
        slug: "retired-cap",
        title: "Retired Cap",
        description: "Reference item",
        imageUrl: "/images/cap.jpg",
        fulfillmentNote: "No longer sold",
        sortOrder: "3",
      }),
    ).resolves.toEqual({
      ok: true,
      entityId: "listing-1",
      revalidatePublicCatalog: false,
    });

    expect(listingUpdate).toHaveBeenCalledWith({
      where: { id: "listing-1" },
      data: {
        slug: "retired-cap",
        title: "Retired Cap",
        description: "Reference item",
        imageUrl: "/images/cap.jpg",
        fulfillmentNote: "No longer sold",
        sortOrder: 3,
      },
      select: { id: true, status: true },
    });
  });

  it("saves listing details and existing variants together", async () => {
    listingFindUnique.mockResolvedValue({
      id: "listing-1",
      imageUrl: "listing/123e4567-e89b-12d3-a456-426614174000-hoodie.png",
      status: "DRAFT",
    });
    variantFindUnique.mockResolvedValueOnce({
      id: "variant-1",
      listingId: "listing-1",
    });
    listingUpdate.mockResolvedValue({ id: "listing-1", status: "DRAFT" });

    await expect(
      saveMarketplaceListing({
        listingId: "listing-1",
        slug: "hoodie-drop",
        title: "Blarney Hoodie",
        description: "Warm layer",
        imageUrl: "listing/123e4567-e89b-12d3-a456-426614174000-hoodie.png",
        fulfillmentNote: "Pickup at check-in",
        sortOrder: "4",
        variants: [
          {
            variantId: "variant-1",
            label: "Medium",
            sku: "HOODIE-M",
            unitAmount: "4500",
            currency: "usd",
            inventoryQuantity: "8",
            isActive: "true",
            sortOrder: "1",
          },
        ],
      }),
    ).resolves.toEqual({
      ok: true,
      entityId: "listing-1",
      revalidatePublicCatalog: false,
    });

    expect(listingUpdate).toHaveBeenCalledWith({
      where: { id: "listing-1" },
      data: {
        slug: "hoodie-drop",
        title: "Blarney Hoodie",
        description: "Warm layer",
        imageUrl: "listing/123e4567-e89b-12d3-a456-426614174000-hoodie.png",
        fulfillmentNote: "Pickup at check-in",
        sortOrder: 4,
      },
      select: { id: true, status: true },
    });
    expect(variantUpdate).toHaveBeenCalledWith({
      where: { id: "variant-1" },
      data: {
        label: "Medium",
        sku: "HOODIE-M",
        unitAmount: 4500,
        currency: "USD",
        inventoryQuantity: 8,
        isActive: true,
        sortOrder: 1,
      },
    });
  });

  it("removes explicitly flagged variants during the combined listing save", async () => {
    listingFindUnique.mockResolvedValue({
      id: "listing-1",
      imageUrl: "listing/123e4567-e89b-12d3-a456-426614174000-hoodie.png",
      status: "DRAFT",
    });
    variantFindUnique
      .mockResolvedValueOnce({
        id: "variant-1",
        listingId: "listing-1",
      })
      .mockResolvedValueOnce({
        id: "variant-2",
        listingId: "listing-1",
      });
    variantDeleteMany.mockResolvedValue({ count: 1 });
    listingUpdate.mockResolvedValue({ id: "listing-1", status: "DRAFT" });

    await expect(
      saveMarketplaceListing({
        listingId: "listing-1",
        slug: "hoodie-drop",
        title: "Blarney Hoodie",
        description: "Updated layer",
        imageUrl: "listing/123e4567-e89b-12d3-a456-426614174000-hoodie.png",
        fulfillmentNote: "Pickup at check-in",
        removedVariantIds: ["variant-2"],
        sortOrder: "4",
        variants: [
          {
            variantId: "variant-1",
            label: "Medium",
            sku: "HOODIE-M",
            unitAmount: "4500",
            currency: "usd",
            inventoryQuantity: "8",
            isActive: "true",
            sortOrder: "1",
          },
        ],
      }),
    ).resolves.toEqual({
      ok: true,
      entityId: "listing-1",
      revalidatePublicCatalog: false,
    });

    expect(variantDeleteMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["variant-2"] },
        listingId: "listing-1",
      },
    });
    expect(listingUpdate).toHaveBeenCalledWith({
      where: { id: "listing-1" },
      data: {
        slug: "hoodie-drop",
        title: "Blarney Hoodie",
        description: "Updated layer",
        imageUrl: "listing/123e4567-e89b-12d3-a456-426614174000-hoodie.png",
        fulfillmentNote: "Pickup at check-in",
        sortOrder: 4,
      },
      select: { id: true, status: true },
    });
  });

  it("rejects removal when a submitted remove id does not belong to the listing", async () => {
    listingFindUnique.mockResolvedValue({
      id: "listing-1",
      imageUrl: "listing/123e4567-e89b-12d3-a456-426614174000-hoodie.png",
      status: "DRAFT",
    });
    variantFindUnique.mockResolvedValueOnce({
      id: "variant-2",
      listingId: "listing-2",
    });

    await expect(
      saveMarketplaceListing({
        listingId: "listing-1",
        slug: "hoodie-drop",
        title: "Blarney Hoodie",
        description: "Warm layer",
        imageUrl: "listing/123e4567-e89b-12d3-a456-426614174000-hoodie.png",
        fulfillmentNote: "Pickup at check-in",
        removedVariantIds: ["variant-2"],
        sortOrder: "4",
        variants: [],
      }),
    ).resolves.toEqual({
      ok: false,
      reason: "not_found",
    });

    expect(variantDeleteMany).not.toHaveBeenCalled();
    expect(listingUpdate).not.toHaveBeenCalled();
  });

  it("rejects a combined save when a submitted variant no longer belongs to the listing", async () => {
    listingFindUnique.mockResolvedValue({
      id: "listing-1",
      imageUrl: "listing/123e4567-e89b-12d3-a456-426614174000-hoodie.png",
      status: "DRAFT",
    });
    variantFindUnique.mockResolvedValueOnce({
      id: "variant-1",
      listingId: "listing-2",
    });

    await expect(
      saveMarketplaceListing({
        listingId: "listing-1",
        slug: "hoodie-drop",
        title: "Blarney Hoodie",
        description: "Warm layer",
        imageUrl: "listing/123e4567-e89b-12d3-a456-426614174000-hoodie.png",
        fulfillmentNote: "Pickup at check-in",
        sortOrder: "4",
        variants: [
          {
            variantId: "variant-1",
            label: "Medium",
            sku: "HOODIE-M",
            unitAmount: "4500",
            currency: "usd",
            inventoryQuantity: "8",
            isActive: "true",
            sortOrder: "1",
          },
        ],
      }),
    ).resolves.toEqual({
      ok: false,
      reason: "not_found",
    });

    expect(listingUpdate).not.toHaveBeenCalled();
    expect(variantUpdate).not.toHaveBeenCalled();
  });

  it("rejects a partially completed new variant before saving any listing changes", async () => {
    await expect(
      saveMarketplaceListing({
        listingId: "listing-1",
        slug: "hoodie-drop",
        title: "Blarney Hoodie",
        description: "Warm layer",
        imageUrl: "listing/123e4567-e89b-12d3-a456-426614174000-hoodie.png",
        fulfillmentNote: "Pickup at check-in",
        sortOrder: "4",
        variants: [],
        newVariant: {
          label: "Large",
          currency: "USD",
        },
      }),
    ).resolves.toEqual({
      ok: false,
      reason: "invalid",
    });

    expect(listingFindUnique).not.toHaveBeenCalled();
    expect(listingUpdate).not.toHaveBeenCalled();
    expect(variantCreate).not.toHaveBeenCalled();
  });

  it("rejects variant creation for archived listings", async () => {
    listingFindUnique.mockResolvedValue({
      id: "listing-1",
      status: "ARCHIVED",
    });

    await expect(
      createMarketplaceListingVariant({
        listingId: "listing-1",
        label: "One Size",
        sku: "CAP-ONE",
        unitAmount: "2200",
        currency: "usd",
        inventoryQuantity: "0",
        isActive: "false",
        sortOrder: "1",
      }),
    ).resolves.toEqual({
      ok: false,
      reason: "invalid",
    });

    expect(variantCreate).not.toHaveBeenCalled();
  });

  it("rejects variant edits for archived listings", async () => {
    variantFindUnique.mockResolvedValue({
      id: "variant-1",
      listing: { status: "ARCHIVED" },
    });

    await expect(
      updateMarketplaceListingVariant({
        variantId: "variant-1",
        listingId: "listing-1",
        label: "One Size",
        sku: "CAP-ONE",
        unitAmount: "2200",
        currency: "usd",
        inventoryQuantity: "0",
        isActive: "false",
        sortOrder: "1",
      }),
    ).resolves.toEqual({
      ok: false,
      reason: "invalid",
    });

    expect(variantUpdate).not.toHaveBeenCalled();
  });
});
