import { PrismaPg } from "@prisma/adapter-pg";
import { MarketplaceListingStatus, PrismaClient } from "@prisma/client";

const adapter = new PrismaPg({
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@localhost:5432/blarney?schema=public",
});

const prisma = new PrismaClient({ adapter });

type SeedVariant = {
  label: string;
  sku: string;
  unitAmount: number;
  currency: string;
  inventoryQuantity: number | null;
  isActive: boolean;
  sortOrder: number;
};

type SeedListing = {
  slug: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  fulfillmentNote: string | null;
  status: MarketplaceListingStatus;
  sortOrder: number;
  variants: SeedVariant[];
};

const merchListings: SeedListing[] = [
  {
    slug: "seed-blarney-hoodie",
    title: "Blarney Hoodie",
    description:
      "Heavyweight fleece hoodie for cool coastal mornings and late-night post-round hangs.",
    imageUrl: null,
    fulfillmentNote: "Pick up at tournament check-in.",
    status: MarketplaceListingStatus.ACTIVE,
    sortOrder: 10,
    variants: [
      {
        label: "Small",
        sku: "SEED-MKT-HOODIE-S",
        unitAmount: 5200,
        currency: "USD",
        inventoryQuantity: 6,
        isActive: true,
        sortOrder: 10,
      },
      {
        label: "Medium",
        sku: "SEED-MKT-HOODIE-M",
        unitAmount: 5200,
        currency: "USD",
        inventoryQuantity: 8,
        isActive: true,
        sortOrder: 20,
      },
      {
        label: "Large",
        sku: "SEED-MKT-HOODIE-L",
        unitAmount: 5200,
        currency: "USD",
        inventoryQuantity: 5,
        isActive: true,
        sortOrder: 30,
      },
    ],
  },
  {
    slug: "seed-blarney-polo",
    title: "Blarney Performance Polo",
    description:
      "Lightweight moisture-wicking polo with a clean tournament-ready look.",
    imageUrl: null,
    fulfillmentNote: "Ships the week after the order window closes.",
    status: MarketplaceListingStatus.ACTIVE,
    sortOrder: 20,
    variants: [
      {
        label: "Medium",
        sku: "SEED-MKT-POLO-M",
        unitAmount: 4600,
        currency: "USD",
        inventoryQuantity: 7,
        isActive: true,
        sortOrder: 10,
      },
      {
        label: "Large",
        sku: "SEED-MKT-POLO-L",
        unitAmount: 4600,
        currency: "USD",
        inventoryQuantity: 7,
        isActive: true,
        sortOrder: 20,
      },
      {
        label: "XL",
        sku: "SEED-MKT-POLO-XL",
        unitAmount: 4600,
        currency: "USD",
        inventoryQuantity: 4,
        isActive: true,
        sortOrder: 30,
      },
    ],
  },
  {
    slug: "seed-blarney-cap",
    title: "Blarney Rope Cap",
    description:
      "One-size tournament cap for the beach, the course, and everything after.",
    imageUrl: null,
    fulfillmentNote: "Limited first run. Reorders depend on demand.",
    status: MarketplaceListingStatus.ACTIVE,
    sortOrder: 30,
    variants: [
      {
        label: "One size",
        sku: "SEED-MKT-CAP-OS",
        unitAmount: 3200,
        currency: "USD",
        inventoryQuantity: null,
        isActive: true,
        sortOrder: 10,
      },
    ],
  },
];

async function seedMarketplaceListings() {
  await prisma.$transaction(async (tx) => {
    for (const listing of merchListings) {
      const savedListing = await tx.marketplaceListing.upsert({
        where: { slug: listing.slug },
        update: {
          title: listing.title,
          description: listing.description,
          imageUrl: listing.imageUrl,
          fulfillmentNote: listing.fulfillmentNote,
          status: listing.status,
          sortOrder: listing.sortOrder,
        },
        create: {
          slug: listing.slug,
          title: listing.title,
          description: listing.description,
          imageUrl: listing.imageUrl,
          fulfillmentNote: listing.fulfillmentNote,
          status: listing.status,
          sortOrder: listing.sortOrder,
        },
        select: {
          id: true,
          title: true,
        },
      });

      for (const variant of listing.variants) {
        await tx.marketplaceListingVariant.upsert({
          where: { sku: variant.sku },
          update: {
            listingId: savedListing.id,
            label: variant.label,
            unitAmount: variant.unitAmount,
            currency: variant.currency,
            inventoryQuantity: variant.inventoryQuantity,
            isActive: variant.isActive,
            sortOrder: variant.sortOrder,
          },
          create: {
            listingId: savedListing.id,
            label: variant.label,
            sku: variant.sku,
            unitAmount: variant.unitAmount,
            currency: variant.currency,
            inventoryQuantity: variant.inventoryQuantity,
            isActive: variant.isActive,
            sortOrder: variant.sortOrder,
          },
        });
      }
    }
  });

  console.log(`Seeded ${merchListings.length} marketplace listings.`);
}

seedMarketplaceListings()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
