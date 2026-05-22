import { db } from "@/lib/db";
import { resolveMarketplaceListingImageUrl } from "@/lib/marketplaceListingImage";
import { Prisma } from "@prisma/client";

const marketplaceCatalogVariantWhere = {
  isActive: true,
  OR: [{ inventoryQuantity: null }, { inventoryQuantity: { gt: 0 } }],
} satisfies Prisma.MarketplaceListingVariantWhereInput;

const marketplaceCatalogVariantSelect = {
  id: true,
  label: true,
  sku: true,
  unitAmount: true,
  currency: true,
  inventoryQuantity: true,
} satisfies Prisma.MarketplaceListingVariantSelect;

const marketplaceCatalogListingSelect = {
  id: true,
  slug: true,
  title: true,
  description: true,
  imageUrl: true,
  fulfillmentNote: true,
  sortOrder: true,
  variants: {
    where: marketplaceCatalogVariantWhere,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: marketplaceCatalogVariantSelect,
  },
} satisfies Prisma.MarketplaceListingSelect;

const marketplaceCheckoutVariantSelect = {
  id: true,
  label: true,
  sku: true,
  unitAmount: true,
  currency: true,
  inventoryQuantity: true,
  listing: {
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      imageUrl: true,
      fulfillmentNote: true,
    },
  },
} satisfies Prisma.MarketplaceListingVariantSelect;

type MarketplaceCatalogClient = Pick<
  typeof db,
  "marketplaceListing" | "marketplaceListingVariant"
>;

export type MarketplaceCatalogListing = Prisma.MarketplaceListingGetPayload<{
  select: typeof marketplaceCatalogListingSelect;
}>;

export type MarketplaceCheckoutVariantRecord =
  Prisma.MarketplaceListingVariantGetPayload<{
    select: typeof marketplaceCheckoutVariantSelect;
  }>;

export async function getMarketplaceCatalog(
  client: MarketplaceCatalogClient = db,
) {
  const listings = await client.marketplaceListing.findMany({
    where: {
      status: "ACTIVE",
      variants: {
        some: marketplaceCatalogVariantWhere,
      },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: marketplaceCatalogListingSelect,
  });

  return listings.map((listing) => ({
    ...listing,
    imageUrl: resolveMarketplaceListingImageUrl(listing.imageUrl),
  }));
}

export async function getMarketplacePurchasableVariantsForCheckout(
  variantIds: string[],
  client: MarketplaceCatalogClient = db,
) {
  const normalizedVariantIds = [...new Set(variantIds.map((id) => id.trim()))]
    .filter((id) => id.length > 0)
    .sort((leftId, rightId) => leftId.localeCompare(rightId));

  if (normalizedVariantIds.length === 0) {
    return [] as MarketplaceCheckoutVariantRecord[];
  }

  return client.marketplaceListingVariant.findMany({
    where: {
      id: { in: normalizedVariantIds },
      isActive: true,
      OR: [{ inventoryQuantity: null }, { inventoryQuantity: { gt: 0 } }],
      listing: {
        status: "ACTIVE",
      },
    },
    select: marketplaceCheckoutVariantSelect,
  });
}
