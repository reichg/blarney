import "server-only";

import { db } from "@/lib/db";
import {
  isLegacyMarketplaceImageUrl,
  isMarketplaceListingImageKey,
} from "@/lib/marketplaceListingImage";
import { MAX_LISTING_VARIANTS } from "@/lib/marketplaceVariants";
import { deletePhotoObject } from "@/lib/s3";
import { Prisma } from "@prisma/client";
import { z } from "zod";

const chairMarketplaceVariantSelect = {
  id: true,
  label: true,
  sku: true,
  unitAmount: true,
  currency: true,
  inventoryQuantity: true,
  isActive: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.MarketplaceListingVariantSelect;

const chairMarketplaceListingSelect = {
  id: true,
  slug: true,
  title: true,
  description: true,
  imageUrl: true,
  fulfillmentNote: true,
  status: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
  variants: {
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: chairMarketplaceVariantSelect,
  },
} satisfies Prisma.MarketplaceListingSelect;

type MarketplaceCatalogAdminClient = Pick<
  typeof db,
  "$transaction" | "marketplaceListing" | "marketplaceListingVariant"
>;

function normalizeRequiredFormValue(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();

    return trimmed.length > 0 ? trimmed : undefined;
  }

  return value ?? undefined;
}

function normalizeOptionalFormValue(value: unknown) {
  if (typeof value !== "string") {
    return value ?? null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const listingIdSchema = z.object({
  listingId: z.preprocess(normalizeRequiredFormValue, z.string().trim().min(1)),
});

const listingSlugSchema = z
  .preprocess(normalizeRequiredFormValue, z.string().trim().min(1).max(80))
  .transform((value) => value.toLowerCase())
  .refine(
    (value) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value),
    "Use lowercase letters, numbers, and single hyphens only.",
  );

const listingTitleSchema = z.preprocess(
  normalizeRequiredFormValue,
  z.string().trim().min(1).max(120),
);

const listingOptionalTextSchema = z
  .preprocess(normalizeOptionalFormValue, z.string().trim().max(600).nullable())
  .transform((value) => value ?? null);

const listingOptionalImageUrlSchema = z
  .preprocess(normalizeOptionalFormValue, z.string().trim().max(500).nullable())
  .transform((value) => value ?? null);

const listingFulfillmentNoteSchema = z
  .preprocess(normalizeOptionalFormValue, z.string().trim().max(200).nullable())
  .transform((value) => value ?? null);

const listingSortOrderSchema = z.preprocess(
  normalizeRequiredFormValue,
  z.coerce.number().int().min(0).max(999),
);

const listingCurrencySchema = z
  .preprocess(normalizeRequiredFormValue, z.string().trim().length(3))
  .transform((value) => value.toUpperCase());

const listingInventoryQuantitySchema = z.preprocess((value) => {
  if (typeof value === "string") {
    const trimmed = value.trim();

    return trimmed.length > 0 ? trimmed : null;
  }

  return value ?? null;
}, z.coerce.number().int().min(0).max(9999).nullable());

const listingIsActiveSchema = z
  .preprocess(normalizeRequiredFormValue, z.enum(["true", "false"]))
  .transform((value) => value === "true");

const marketplaceListingCreateSchema = z.object({
  slug: listingSlugSchema,
  title: listingTitleSchema,
  description: listingOptionalTextSchema,
  imageUrl: listingOptionalImageUrlSchema,
  fulfillmentNote: listingFulfillmentNoteSchema,
  sortOrder: listingSortOrderSchema,
});

const marketplaceListingUpdateSchema = marketplaceListingCreateSchema.extend({
  listingId: z.preprocess(normalizeRequiredFormValue, z.string().trim().min(1)),
});

const marketplaceListingVariantCreateSchema = z.object({
  listingId: z.preprocess(normalizeRequiredFormValue, z.string().trim().min(1)),
  label: z.preprocess(
    normalizeRequiredFormValue,
    z.string().trim().min(1).max(120),
  ),
  sku: z
    .preprocess(
      normalizeOptionalFormValue,
      z.string().trim().max(120).nullable(),
    )
    .transform((value) => value ?? null),
  unitAmount: z.preprocess(
    normalizeRequiredFormValue,
    z.coerce.number().int().min(0).max(1_000_000),
  ),
  currency: listingCurrencySchema,
  inventoryQuantity: listingInventoryQuantitySchema,
  isActive: listingIsActiveSchema,
  sortOrder: listingSortOrderSchema,
});

const marketplaceListingVariantUpdateSchema =
  marketplaceListingVariantCreateSchema.extend({
    variantId: z.preprocess(
      normalizeRequiredFormValue,
      z.string().trim().min(1),
    ),
  });

const marketplaceListingVariantSaveSchema =
  marketplaceListingVariantUpdateSchema.omit({ listingId: true });

const marketplaceListingDraftVariantSchema =
  marketplaceListingVariantCreateSchema.omit({ listingId: true });

const marketplaceListingCreateWithVariantsSchema =
  marketplaceListingCreateSchema.extend({
    variants: z.array(z.unknown()).max(MAX_LISTING_VARIANTS).default([]),
  });

const marketplaceListingRemovedVariantIdSchema = z
  .array(z.preprocess(normalizeRequiredFormValue, z.string().trim().min(1)))
  .default([]);

const marketplaceListingSaveSchema = marketplaceListingUpdateSchema.extend({
  newVariants: z.array(z.unknown()).max(MAX_LISTING_VARIANTS).default([]),
  removedVariantIds: marketplaceListingRemovedVariantIdSchema,
  variants: z.array(marketplaceListingVariantSaveSchema).default([]),
});

function getPrismaErrorCode(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }

  return null;
}

function getPrismaErrorTargetFields(error: unknown) {
  if (
    typeof error !== "object" ||
    error === null ||
    !("meta" in error) ||
    typeof error.meta !== "object" ||
    error.meta === null ||
    !("target" in error.meta)
  ) {
    return [] as string[];
  }

  const { target } = error.meta as { target?: unknown };

  return Array.isArray(target)
    ? target.filter((value): value is string => typeof value === "string")
    : [];
}

function getDuplicateConstraintReason(
  error: unknown,
): MarketplaceCatalogMutationErrorReason | null {
  if (getPrismaErrorCode(error) !== "P2002") {
    return null;
  }

  const targetFields = getPrismaErrorTargetFields(error);

  if (targetFields.includes("slug")) {
    return "duplicate_slug";
  }

  if (targetFields.includes("sku")) {
    return "duplicate_sku";
  }

  if (targetFields.includes("label")) {
    return "duplicate_variant_label";
  }

  return "invalid";
}

function isMissingRecordError(error: unknown) {
  const code = getPrismaErrorCode(error);
  return code === "P2025" || code === "P2003";
}

export type ChairMarketplaceCatalogListing =
  Prisma.MarketplaceListingGetPayload<{
    select: typeof chairMarketplaceListingSelect;
  }>;

export type MarketplaceCatalogMutationErrorReason =
  | "invalid"
  | "not_found"
  | "duplicate_slug"
  | "duplicate_sku"
  | "duplicate_variant_label"
  | "requires_active_variant";

export type MarketplaceCatalogMutationResult =
  | {
      ok: true;
      entityId: string;
      revalidatePublicCatalog: boolean;
    }
  | {
      ok: false;
      reason: MarketplaceCatalogMutationErrorReason;
    };

export type MarketplaceCatalogStatusMutationResult =
  | {
      ok: true;
      entityId: string;
      revalidatePublicCatalog: boolean;
      status: "DRAFT" | "ACTIVE" | "ARCHIVED";
    }
  | {
      ok: false;
      reason: MarketplaceCatalogMutationErrorReason;
    };

function shouldRevalidatePublicCatalogForListingStatus(
  status: ChairMarketplaceCatalogListing["status"],
) {
  return status === "ACTIVE";
}

function normalizeManagedMarketplaceListingImageKey(
  value: string | null | undefined,
) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  if (isMarketplaceListingImageKey(trimmedValue)) {
    return trimmedValue;
  }

  const normalizedValue = trimmedValue.replace(/^\/+/, "");
  return isMarketplaceListingImageKey(normalizedValue) ? normalizedValue : null;
}

function logMarketplaceCatalogEvent(
  level: "warn" | "error",
  event: string,
  details: Record<string, string | number | boolean | null | undefined>,
) {
  const logger = level === "error" ? console.error : console.warn;

  logger(`[marketplace-catalog] ${event}`, details);
}

// Best-effort S3 cleanup once a listing image is no longer referenced
// (replaced, cleared, or its listing deleted). Only managed listing/* keys are
// deleted; legacy http(s)/path URLs are untouched. Must run only after the DB
// change has committed.
async function deleteReplacedListingImage(
  listingId: string,
  previousImageUrl: string | null,
  nextImageUrl: string | null,
) {
  const previousImageKey =
    normalizeManagedMarketplaceListingImageKey(previousImageUrl);

  if (
    !previousImageKey ||
    previousImageKey ===
      normalizeManagedMarketplaceListingImageKey(nextImageUrl)
  ) {
    return;
  }

  try {
    await deletePhotoObject(previousImageKey);
  } catch (error) {
    logMarketplaceCatalogEvent("warn", "listing-image-delete-failed", {
      imageKey: previousImageKey,
      listingId,
      message: error instanceof Error ? error.message : "unknown",
    });
  }
}

export async function getChairMarketplaceCatalog(
  client: MarketplaceCatalogAdminClient = db,
) {
  return client.marketplaceListing.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: chairMarketplaceListingSelect,
  });
}

export async function createMarketplaceListing(
  input: unknown,
  client: MarketplaceCatalogAdminClient = db,
): Promise<MarketplaceCatalogMutationResult> {
  const parsed = marketplaceListingCreateWithVariantsSchema.safeParse(input);

  if (
    !parsed.success ||
    (parsed.data.imageUrl !== null &&
      !isMarketplaceListingImageKey(parsed.data.imageUrl))
  ) {
    return { ok: false, reason: "invalid" };
  }

  const parsedVariants = parsed.data.variants.map((value) =>
    marketplaceListingDraftVariantSchema.safeParse(value),
  );

  if (parsedVariants.some((result) => !result.success)) {
    return { ok: false, reason: "invalid" };
  }

  const variantData = parsedVariants.flatMap((result) =>
    result.success ? [result.data] : [],
  );

  try {
    const createdListing = await client.$transaction(async (transaction) => {
      const listing = await transaction.marketplaceListing.create({
        data: {
          slug: parsed.data.slug,
          title: parsed.data.title,
          description: parsed.data.description,
          imageUrl: parsed.data.imageUrl,
          fulfillmentNote: parsed.data.fulfillmentNote,
          sortOrder: parsed.data.sortOrder,
          status: "DRAFT",
        },
        select: { id: true },
      });

      for (const variant of variantData) {
        await transaction.marketplaceListingVariant.create({
          data: {
            listingId: listing.id,
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

      return listing;
    });

    return {
      ok: true,
      entityId: createdListing.id,
      revalidatePublicCatalog: false,
    };
  } catch (error) {
    const duplicateReason = getDuplicateConstraintReason(error);

    if (duplicateReason) {
      return { ok: false, reason: duplicateReason };
    }

    return { ok: false, reason: "invalid" };
  }
}

export async function updateMarketplaceListing(
  input: unknown,
  client: MarketplaceCatalogAdminClient = db,
): Promise<MarketplaceCatalogMutationResult> {
  const parsed = marketplaceListingUpdateSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, reason: "invalid" };
  }

  try {
    const listing = await client.marketplaceListing.findUnique({
      where: { id: parsed.data.listingId },
      select: { id: true, imageUrl: true, status: true },
    });

    if (!listing) {
      return { ok: false, reason: "not_found" };
    }

    if (listing.status === "ARCHIVED") {
      return { ok: false, reason: "invalid" };
    }

    const nextImageUrl = parsed.data.imageUrl;
    const existingImageUrl = listing.imageUrl;

    if (
      nextImageUrl !== null &&
      !isMarketplaceListingImageKey(nextImageUrl) &&
      (!existingImageUrl ||
        nextImageUrl !== existingImageUrl ||
        !isLegacyMarketplaceImageUrl(existingImageUrl))
    ) {
      return { ok: false, reason: "invalid" };
    }

    const updatedListing = await client.marketplaceListing.update({
      where: { id: parsed.data.listingId },
      data: {
        slug: parsed.data.slug,
        title: parsed.data.title,
        description: parsed.data.description,
        imageUrl: nextImageUrl,
        fulfillmentNote: parsed.data.fulfillmentNote,
        sortOrder: parsed.data.sortOrder,
      },
      select: { id: true, status: true },
    });

    await deleteReplacedListingImage(
      updatedListing.id,
      existingImageUrl,
      nextImageUrl,
    );

    return {
      ok: true,
      entityId: updatedListing.id,
      revalidatePublicCatalog: updatedListing.status === "ACTIVE",
    };
  } catch (error) {
    if (isMissingRecordError(error)) {
      return { ok: false, reason: "not_found" };
    }

    const duplicateReason = getDuplicateConstraintReason(error);

    if (duplicateReason) {
      return { ok: false, reason: duplicateReason };
    }

    return { ok: false, reason: "invalid" };
  }
}

export async function saveMarketplaceListing(
  input: unknown,
  client: MarketplaceCatalogAdminClient = db,
): Promise<MarketplaceCatalogMutationResult> {
  const parsed = marketplaceListingSaveSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, reason: "invalid" };
  }

  const parsedNewVariants = parsed.data.newVariants.map((value) =>
    marketplaceListingDraftVariantSchema.safeParse(value),
  );

  if (parsedNewVariants.some((result) => !result.success)) {
    return { ok: false, reason: "invalid" };
  }

  const newVariantData = parsedNewVariants.flatMap((result) =>
    result.success ? [result.data] : [],
  );

  if (parsed.data.variants.length + newVariantData.length > MAX_LISTING_VARIANTS) {
    return { ok: false, reason: "invalid" };
  }

  const retainedVariantIds = new Set<string>();

  for (const variant of parsed.data.variants) {
    if (retainedVariantIds.has(variant.variantId)) {
      return { ok: false, reason: "invalid" };
    }

    retainedVariantIds.add(variant.variantId);
  }

  const removedVariantIds = new Set<string>();

  for (const removedVariantId of parsed.data.removedVariantIds) {
    if (
      removedVariantIds.has(removedVariantId) ||
      retainedVariantIds.has(removedVariantId)
    ) {
      return { ok: false, reason: "invalid" };
    }

    removedVariantIds.add(removedVariantId);
  }

  let previousImageUrl: string | null = null;

  try {
    const saveResult = await client.$transaction(async (transaction) => {
      const listing = await transaction.marketplaceListing.findUnique({
        where: { id: parsed.data.listingId },
        select: { id: true, imageUrl: true, status: true },
      });

      if (!listing) {
        return { ok: false, reason: "not_found" } as const;
      }

      if (listing.status === "ARCHIVED") {
        return { ok: false, reason: "invalid" } as const;
      }

      const nextImageUrl = parsed.data.imageUrl;
      const existingImageUrl = listing.imageUrl;
      previousImageUrl = existingImageUrl;

      if (
        nextImageUrl !== null &&
        !isMarketplaceListingImageKey(nextImageUrl) &&
        (!existingImageUrl ||
          nextImageUrl !== existingImageUrl ||
          !isLegacyMarketplaceImageUrl(existingImageUrl))
      ) {
        return { ok: false, reason: "invalid" } as const;
      }

      for (const variant of parsed.data.variants) {
        const existingVariant =
          await transaction.marketplaceListingVariant.findUnique({
            where: { id: variant.variantId },
            select: { id: true, listingId: true },
          });

        if (
          !existingVariant ||
          existingVariant.listingId !== parsed.data.listingId
        ) {
          return { ok: false, reason: "not_found" } as const;
        }
      }

      for (const removedVariantId of removedVariantIds) {
        const existingVariant =
          await transaction.marketplaceListingVariant.findUnique({
            where: { id: removedVariantId },
            select: { id: true, listingId: true },
          });

        if (
          !existingVariant ||
          existingVariant.listingId !== parsed.data.listingId
        ) {
          return { ok: false, reason: "not_found" } as const;
        }
      }

      if (removedVariantIds.size > 0) {
        const deletedVariants =
          await transaction.marketplaceListingVariant.deleteMany({
            where: {
              id: { in: Array.from(removedVariantIds) },
              listingId: parsed.data.listingId,
            },
          });

        if (deletedVariants.count !== removedVariantIds.size) {
          throw new Error("marketplace_variant_delete_mismatch");
        }
      }

      const updatedListing = await transaction.marketplaceListing.update({
        where: { id: parsed.data.listingId },
        data: {
          slug: parsed.data.slug,
          title: parsed.data.title,
          description: parsed.data.description,
          imageUrl: nextImageUrl,
          fulfillmentNote: parsed.data.fulfillmentNote,
          sortOrder: parsed.data.sortOrder,
        },
        select: { id: true, status: true },
      });

      for (const variant of parsed.data.variants) {
        await transaction.marketplaceListingVariant.update({
          where: { id: variant.variantId },
          data: {
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

      for (const newVariant of newVariantData) {
        await transaction.marketplaceListingVariant.create({
          data: {
            listingId: parsed.data.listingId,
            label: newVariant.label,
            sku: newVariant.sku,
            unitAmount: newVariant.unitAmount,
            currency: newVariant.currency,
            inventoryQuantity: newVariant.inventoryQuantity,
            isActive: newVariant.isActive,
            sortOrder: newVariant.sortOrder,
          },
        });
      }

      return {
        ok: true,
        entityId: updatedListing.id,
        revalidatePublicCatalog: updatedListing.status === "ACTIVE",
      } as const;
    });

    if (saveResult.ok) {
      await deleteReplacedListingImage(
        saveResult.entityId,
        previousImageUrl,
        parsed.data.imageUrl,
      );
    }

    return saveResult;
  } catch (error) {
    if (isMissingRecordError(error)) {
      return { ok: false, reason: "not_found" };
    }

    const duplicateReason = getDuplicateConstraintReason(error);

    if (duplicateReason) {
      return { ok: false, reason: duplicateReason };
    }

    return { ok: false, reason: "invalid" };
  }
}

export async function publishMarketplaceListing(
  input: unknown,
  client: MarketplaceCatalogAdminClient = db,
): Promise<MarketplaceCatalogStatusMutationResult> {
  const parsed = listingIdSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, reason: "invalid" };
  }

  return client.$transaction(async (transaction) => {
    const listing = await transaction.marketplaceListing.findUnique({
      where: { id: parsed.data.listingId },
      select: { id: true, status: true },
    });

    if (!listing) {
      return { ok: false, reason: "not_found" } as const;
    }

    if (listing.status === "ARCHIVED") {
      return { ok: false, reason: "invalid" } as const;
    }

    const activeVariantCount =
      await transaction.marketplaceListingVariant.count({
        where: {
          listingId: parsed.data.listingId,
          isActive: true,
        },
      });

    if (activeVariantCount === 0) {
      return { ok: false, reason: "requires_active_variant" } as const;
    }

    if (listing.status !== "ACTIVE") {
      await transaction.marketplaceListing.update({
        where: { id: parsed.data.listingId },
        data: { status: "ACTIVE" },
      });
    }

    return {
      ok: true,
      entityId: parsed.data.listingId,
      revalidatePublicCatalog: true,
      status: "ACTIVE",
    } as const;
  });
}

export async function unpublishMarketplaceListing(
  input: unknown,
  client: MarketplaceCatalogAdminClient = db,
): Promise<MarketplaceCatalogStatusMutationResult> {
  const parsed = listingIdSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, reason: "invalid" };
  }

  try {
    const listing = await client.marketplaceListing.findUnique({
      where: { id: parsed.data.listingId },
      select: { id: true, status: true },
    });

    if (!listing) {
      return { ok: false, reason: "not_found" };
    }

    if (listing.status === "ARCHIVED") {
      return { ok: false, reason: "invalid" };
    }

    if (listing.status !== "DRAFT") {
      await client.marketplaceListing.update({
        where: { id: parsed.data.listingId },
        data: { status: "DRAFT" },
      });
    }

    return {
      ok: true,
      entityId: parsed.data.listingId,
      revalidatePublicCatalog: shouldRevalidatePublicCatalogForListingStatus(
        listing.status,
      ),
      status: "DRAFT",
    };
  } catch (error) {
    if (isMissingRecordError(error)) {
      return { ok: false, reason: "not_found" };
    }

    return { ok: false, reason: "invalid" };
  }
}

export async function archiveMarketplaceListing(
  input: unknown,
  client: MarketplaceCatalogAdminClient = db,
): Promise<MarketplaceCatalogStatusMutationResult> {
  const parsed = listingIdSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, reason: "invalid" };
  }

  try {
    const listing = await client.marketplaceListing.findUnique({
      where: { id: parsed.data.listingId },
      select: { id: true, status: true },
    });

    if (!listing) {
      return { ok: false, reason: "not_found" };
    }

    if (listing.status !== "ARCHIVED") {
      await client.marketplaceListing.update({
        where: { id: parsed.data.listingId },
        data: { status: "ARCHIVED" },
      });
    }

    return {
      ok: true,
      entityId: parsed.data.listingId,
      revalidatePublicCatalog: shouldRevalidatePublicCatalogForListingStatus(
        listing.status,
      ),
      status: "ARCHIVED",
    };
  } catch (error) {
    if (isMissingRecordError(error)) {
      return { ok: false, reason: "not_found" };
    }

    return { ok: false, reason: "invalid" };
  }
}

export async function restoreMarketplaceListing(
  input: unknown,
  client: MarketplaceCatalogAdminClient = db,
): Promise<MarketplaceCatalogStatusMutationResult> {
  const parsed = listingIdSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, reason: "invalid" };
  }

  try {
    const listing = await client.marketplaceListing.findUnique({
      where: { id: parsed.data.listingId },
      select: { id: true, status: true },
    });

    if (!listing) {
      return { ok: false, reason: "not_found" };
    }

    if (listing.status === "ACTIVE") {
      return { ok: false, reason: "invalid" };
    }

    if (listing.status !== "DRAFT") {
      await client.marketplaceListing.update({
        where: { id: parsed.data.listingId },
        data: { status: "DRAFT" },
      });
    }

    return {
      ok: true,
      entityId: parsed.data.listingId,
      revalidatePublicCatalog: false,
      status: "DRAFT",
    };
  } catch (error) {
    if (isMissingRecordError(error)) {
      return { ok: false, reason: "not_found" };
    }

    return { ok: false, reason: "invalid" };
  }
}

export async function deleteMarketplaceListing(
  input: unknown,
  client: MarketplaceCatalogAdminClient = db,
): Promise<MarketplaceCatalogMutationResult> {
  const parsed = listingIdSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, reason: "invalid" };
  }

  try {
    const deleteResult = await client.$transaction(async (transaction) => {
      const listing = await transaction.marketplaceListing.findUnique({
        where: { id: parsed.data.listingId },
        select: { id: true, imageUrl: true, status: true },
      });

      if (!listing) {
        return { kind: "error", reason: "not_found" } as const;
      }

      const deletedListing = await transaction.marketplaceListing.deleteMany({
        where: { id: parsed.data.listingId },
      });

      if (deletedListing.count !== 1) {
        return { kind: "error", reason: "invalid" } as const;
      }

      return {
        kind: "deleted",
        entityId: listing.id,
        // Removing a published listing must refresh the public catalog so it
        // disappears; drafts and archived listings are never public.
        revalidatePublicCatalog:
          shouldRevalidatePublicCatalogForListingStatus(listing.status),
        imageUrl: listing.imageUrl,
      } as const;
    });

    if (deleteResult.kind === "error") {
      return { ok: false, reason: deleteResult.reason };
    }

    await deleteReplacedListingImage(
      deleteResult.entityId,
      deleteResult.imageUrl,
      null,
    );

    return {
      ok: true,
      entityId: deleteResult.entityId,
      revalidatePublicCatalog: deleteResult.revalidatePublicCatalog,
    };
  } catch (error) {
    if (isMissingRecordError(error)) {
      return { ok: false, reason: "not_found" };
    }

    return { ok: false, reason: "invalid" };
  }
}

export async function createMarketplaceListingVariant(
  input: unknown,
  client: MarketplaceCatalogAdminClient = db,
): Promise<MarketplaceCatalogMutationResult> {
  const parsed = marketplaceListingVariantCreateSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, reason: "invalid" };
  }

  const listing = await client.marketplaceListing.findUnique({
    where: { id: parsed.data.listingId },
    select: { id: true, status: true },
  });

  if (!listing) {
    return { ok: false, reason: "not_found" };
  }

  if (listing.status === "ARCHIVED") {
    return { ok: false, reason: "invalid" };
  }

  try {
    const createdVariant = await client.marketplaceListingVariant.create({
      data: {
        listingId: parsed.data.listingId,
        label: parsed.data.label,
        sku: parsed.data.sku,
        unitAmount: parsed.data.unitAmount,
        currency: parsed.data.currency,
        inventoryQuantity: parsed.data.inventoryQuantity,
        isActive: parsed.data.isActive,
        sortOrder: parsed.data.sortOrder,
      },
      select: { id: true },
    });

    return {
      ok: true,
      entityId: createdVariant.id,
      revalidatePublicCatalog: listing.status === "ACTIVE",
    };
  } catch (error) {
    const duplicateReason = getDuplicateConstraintReason(error);

    if (duplicateReason) {
      return { ok: false, reason: duplicateReason };
    }

    if (isMissingRecordError(error)) {
      return { ok: false, reason: "not_found" };
    }

    return { ok: false, reason: "invalid" };
  }
}

export async function updateMarketplaceListingVariant(
  input: unknown,
  client: MarketplaceCatalogAdminClient = db,
): Promise<MarketplaceCatalogMutationResult> {
  const parsed = marketplaceListingVariantUpdateSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, reason: "invalid" };
  }

  try {
    const variant = await client.marketplaceListingVariant.findUnique({
      where: { id: parsed.data.variantId },
      select: {
        id: true,
        listing: {
          select: {
            status: true,
          },
        },
      },
    });

    if (!variant) {
      return { ok: false, reason: "not_found" };
    }

    if (variant.listing.status === "ARCHIVED") {
      return { ok: false, reason: "invalid" };
    }

    const updatedVariant = await client.marketplaceListingVariant.update({
      where: { id: parsed.data.variantId },
      data: {
        label: parsed.data.label,
        sku: parsed.data.sku,
        unitAmount: parsed.data.unitAmount,
        currency: parsed.data.currency,
        inventoryQuantity: parsed.data.inventoryQuantity,
        isActive: parsed.data.isActive,
        sortOrder: parsed.data.sortOrder,
      },
      select: {
        id: true,
        listing: {
          select: {
            status: true,
          },
        },
      },
    });

    return {
      ok: true,
      entityId: updatedVariant.id,
      revalidatePublicCatalog: updatedVariant.listing.status === "ACTIVE",
    };
  } catch (error) {
    if (isMissingRecordError(error)) {
      return { ok: false, reason: "not_found" };
    }

    const duplicateReason = getDuplicateConstraintReason(error);

    if (duplicateReason) {
      return { ok: false, reason: duplicateReason };
    }

    return { ok: false, reason: "invalid" };
  }
}
