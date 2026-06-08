"use server";

import { CHAIR_COOKIE, verifyChairToken } from "@/lib/auth";
import {
  archiveMarketplaceListing,
  createMarketplaceListing,
  createMarketplaceListingVariant,
  deleteMarketplaceListing,
  publishMarketplaceListing,
  restoreMarketplaceListing,
  saveMarketplaceListing,
  unpublishMarketplaceListing,
  updateMarketplaceListing,
  updateMarketplaceListingVariant,
  type MarketplaceCatalogMutationErrorReason,
} from "@/lib/marketplaceCatalogAdmin";
import { updateMarketplaceOrderFulfillmentStatus } from "@/lib/marketplaceChair";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

const chairMarketplacePath = "/chair/marketplace";
const publicMarketplacePath = "/marketplace";

export type MarketplaceActionResult = { redirectTo: string };

const marketplaceFulfillmentActionSchema = z.object({
  orderId: z.string().trim().min(1),
  nextStatus: z.enum(["READY", "FULFILLED"]),
});

const marketplaceListingIdActionSchema = z.object({
  listingId: z.string().trim().min(1),
});

async function requireChairSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(CHAIR_COOKIE)?.value;
  const isAuthorized = await verifyChairToken(token);

  if (!isAuthorized) {
    redirect("/chair/login");
  }
}

function getMarketplaceTransitionNotice(status: "READY" | "FULFILLED") {
  return status === "READY" ? "ready" : "fulfilled";
}

function getMarketplaceCatalogFailureNotice(
  reason: MarketplaceCatalogMutationErrorReason,
) {
  switch (reason) {
    case "duplicate_slug":
      return "catalog-duplicate-slug";
    case "duplicate_sku":
      return "catalog-duplicate-sku";
    case "duplicate_variant_label":
      return "catalog-duplicate-variant-label";
    case "requires_active_variant":
      return "catalog-requires-active-variant";
    case "not_found":
      return "catalog-not-found";
    case "invalid":
    default:
      return "catalog-invalid";
  }
}

function marketplaceNoticeResult(notice: string): MarketplaceActionResult {
  return { redirectTo: `${chairMarketplacePath}?marketplace=${notice}` };
}

function redirectToMarketplaceNotice(notice: string): never {
  redirect(`${chairMarketplacePath}?marketplace=${notice}`);
}

function revalidateMarketplacePaths(includePublicMarketplace = false) {
  revalidatePath(chairMarketplacePath);

  if (includePublicMarketplace) {
    revalidatePath(publicMarketplacePath);
  }
}

function hasMarketplaceFormValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim().length > 0 : value !== null;
}

function getMarketplaceVariantFormEntries(formData: FormData) {
  const variantIds = formData.getAll("variantId");
  const labels = formData.getAll("variantLabel");
  const skus = formData.getAll("variantSku");
  const unitAmounts = formData.getAll("variantUnitAmount");
  const currencies = formData.getAll("variantCurrency");
  const inventoryQuantities = formData.getAll("variantInventoryQuantity");
  const isActiveValues = formData.getAll("variantIsActive");
  const sortOrders = formData.getAll("variantSortOrder");

  return variantIds.map((variantId, index) => ({
    currency: currencies[index],
    inventoryQuantity: inventoryQuantities[index],
    isActive: isActiveValues[index],
    label: labels[index],
    sku: skus[index],
    sortOrder: sortOrders[index],
    unitAmount: unitAmounts[index],
    variantId,
  }));
}

function getMarketplaceRemovedVariantIds(formData: FormData) {
  return formData.getAll("removeVariantId").filter((value): value is string => {
    return typeof value === "string" && value.trim().length > 0;
  });
}

function getMarketplaceDraftVariantInputs(formData: FormData) {
  const currencies = formData.getAll("newVariantCurrency");
  const inventoryQuantities = formData.getAll("newVariantInventoryQuantity");
  const isActiveValues = formData.getAll("newVariantIsActive");
  const labels = formData.getAll("newVariantLabel");
  const skus = formData.getAll("newVariantSku");
  const sortOrders = formData.getAll("newVariantSortOrder");
  const unitAmounts = formData.getAll("newVariantUnitAmount");

  const rowCount = Math.max(
    currencies.length,
    inventoryQuantities.length,
    isActiveValues.length,
    labels.length,
    skus.length,
    sortOrders.length,
    unitAmounts.length,
  );

  const newVariants = [];

  for (let index = 0; index < rowCount; index += 1) {
    const newVariant = {
      currency: currencies[index] ?? null,
      inventoryQuantity: inventoryQuantities[index] ?? null,
      isActive: isActiveValues[index] ?? null,
      label: labels[index] ?? null,
      sku: skus[index] ?? null,
      sortOrder: sortOrders[index] ?? null,
      unitAmount: unitAmounts[index] ?? null,
    };

    // Only user-entered fields count toward presence: isActive always emits
    // a <select> value and currency carries a default, so they cannot drop
    // an otherwise-blank row.
    const isPresent = [
      newVariant.label,
      newVariant.sku,
      newVariant.unitAmount,
      newVariant.inventoryQuantity,
      newVariant.sortOrder,
    ].some((value) => hasMarketplaceFormValue(value));

    if (isPresent) {
      newVariants.push(newVariant);
    }
  }

  return newVariants;
}

export async function updateMarketplaceFulfillmentStatusAction(
  formData: FormData,
): Promise<MarketplaceActionResult> {
  await requireChairSession();

  const parsed = marketplaceFulfillmentActionSchema.safeParse({
    orderId: formData.get("orderId"),
    nextStatus: formData.get("nextStatus"),
  });

  if (!parsed.success) {
    return marketplaceNoticeResult("transition-error");
  }

  let result: Awaited<
    ReturnType<typeof updateMarketplaceOrderFulfillmentStatus>
  >;

  try {
    result = await updateMarketplaceOrderFulfillmentStatus(parsed.data);
  } catch {
    return marketplaceNoticeResult("transition-error");
  }

  if (!result.ok) {
    return marketplaceNoticeResult("transition-error");
  }

  revalidatePath(chairMarketplacePath);
  return marketplaceNoticeResult(getMarketplaceTransitionNotice(result.status));
}

export async function createMarketplaceListingAction(
  formData: FormData,
): Promise<MarketplaceActionResult> {
  await requireChairSession();

  let result: Awaited<ReturnType<typeof createMarketplaceListing>>;

  try {
    result = await createMarketplaceListing({
      slug: formData.get("slug"),
      title: formData.get("title"),
      description: formData.get("description"),
      imageUrl: formData.get("imageUrl"),
      fulfillmentNote: formData.get("fulfillmentNote"),
      sortOrder: formData.get("sortOrder"),
      variants: getMarketplaceDraftVariantInputs(formData),
    });
  } catch {
    return marketplaceNoticeResult("catalog-error");
  }

  if (!result.ok) {
    return marketplaceNoticeResult(
      getMarketplaceCatalogFailureNotice(result.reason),
    );
  }

  revalidateMarketplacePaths(result.revalidatePublicCatalog);
  return marketplaceNoticeResult("listing-created");
}

export async function updateMarketplaceListingAction(formData: FormData) {
  await requireChairSession();

  let result;

  try {
    result = await updateMarketplaceListing({
      listingId: formData.get("listingId"),
      slug: formData.get("slug"),
      title: formData.get("title"),
      description: formData.get("description"),
      imageUrl: formData.get("imageUrl"),
      fulfillmentNote: formData.get("fulfillmentNote"),
      sortOrder: formData.get("sortOrder"),
    });
  } catch {
    redirectToMarketplaceNotice("catalog-error");
  }

  if (!result.ok) {
    redirectToMarketplaceNotice(
      getMarketplaceCatalogFailureNotice(result.reason),
    );
  }

  revalidateMarketplacePaths(result.revalidatePublicCatalog);
  redirectToMarketplaceNotice("listing-updated");
}

export async function saveMarketplaceListingAction(
  formData: FormData,
): Promise<MarketplaceActionResult> {
  await requireChairSession();

  let result: Awaited<ReturnType<typeof saveMarketplaceListing>>;

  try {
    result = await saveMarketplaceListing({
      description: formData.get("description"),
      fulfillmentNote: formData.get("fulfillmentNote"),
      imageUrl: formData.get("imageUrl"),
      listingId: formData.get("listingId"),
      newVariants: getMarketplaceDraftVariantInputs(formData),
      removedVariantIds: getMarketplaceRemovedVariantIds(formData),
      slug: formData.get("slug"),
      sortOrder: formData.get("sortOrder"),
      title: formData.get("title"),
      variants: getMarketplaceVariantFormEntries(formData),
    });
  } catch {
    return marketplaceNoticeResult("catalog-error");
  }

  if (!result.ok) {
    return marketplaceNoticeResult(
      getMarketplaceCatalogFailureNotice(result.reason),
    );
  }

  revalidateMarketplacePaths(result.revalidatePublicCatalog);
  return marketplaceNoticeResult("listing-updated");
}

export async function publishMarketplaceListingAction(
  formData: FormData,
): Promise<MarketplaceActionResult> {
  await requireChairSession();

  const parsed = marketplaceListingIdActionSchema.safeParse({
    listingId: formData.get("listingId"),
  });

  if (!parsed.success) {
    return marketplaceNoticeResult("catalog-invalid");
  }

  let result: Awaited<ReturnType<typeof publishMarketplaceListing>>;

  try {
    result = await publishMarketplaceListing(parsed.data);
  } catch {
    return marketplaceNoticeResult("catalog-error");
  }

  if (!result.ok) {
    return marketplaceNoticeResult(
      getMarketplaceCatalogFailureNotice(result.reason),
    );
  }

  revalidateMarketplacePaths(result.revalidatePublicCatalog);
  return marketplaceNoticeResult("listing-published");
}

export async function unpublishMarketplaceListingAction(
  formData: FormData,
): Promise<MarketplaceActionResult> {
  await requireChairSession();

  const parsed = marketplaceListingIdActionSchema.safeParse({
    listingId: formData.get("listingId"),
  });

  if (!parsed.success) {
    return marketplaceNoticeResult("catalog-invalid");
  }

  let result: Awaited<ReturnType<typeof unpublishMarketplaceListing>>;

  try {
    result = await unpublishMarketplaceListing(parsed.data);
  } catch {
    return marketplaceNoticeResult("catalog-error");
  }

  if (!result.ok) {
    return marketplaceNoticeResult(
      getMarketplaceCatalogFailureNotice(result.reason),
    );
  }

  revalidateMarketplacePaths(result.revalidatePublicCatalog);
  return marketplaceNoticeResult("listing-unpublished");
}

export async function archiveMarketplaceListingAction(
  formData: FormData,
): Promise<MarketplaceActionResult> {
  await requireChairSession();

  const parsed = marketplaceListingIdActionSchema.safeParse({
    listingId: formData.get("listingId"),
  });

  if (!parsed.success) {
    return marketplaceNoticeResult("catalog-invalid");
  }

  let result: Awaited<ReturnType<typeof archiveMarketplaceListing>>;

  try {
    result = await archiveMarketplaceListing(parsed.data);
  } catch {
    return marketplaceNoticeResult("catalog-error");
  }

  if (!result.ok) {
    return marketplaceNoticeResult(
      getMarketplaceCatalogFailureNotice(result.reason),
    );
  }

  revalidateMarketplacePaths(result.revalidatePublicCatalog);
  return marketplaceNoticeResult("listing-archived");
}

export async function restoreMarketplaceListingAction(
  formData: FormData,
): Promise<MarketplaceActionResult> {
  await requireChairSession();

  const parsed = marketplaceListingIdActionSchema.safeParse({
    listingId: formData.get("listingId"),
  });

  if (!parsed.success) {
    return marketplaceNoticeResult("catalog-invalid");
  }

  let result: Awaited<ReturnType<typeof restoreMarketplaceListing>>;

  try {
    result = await restoreMarketplaceListing(parsed.data);
  } catch {
    return marketplaceNoticeResult("catalog-error");
  }

  if (!result.ok) {
    return marketplaceNoticeResult(
      getMarketplaceCatalogFailureNotice(result.reason),
    );
  }

  revalidateMarketplacePaths(result.revalidatePublicCatalog);
  return marketplaceNoticeResult("listing-restored");
}

export async function deleteMarketplaceListingAction(
  formData: FormData,
): Promise<MarketplaceActionResult> {
  await requireChairSession();

  const parsed = marketplaceListingIdActionSchema.safeParse({
    listingId: formData.get("listingId"),
  });

  if (!parsed.success) {
    return marketplaceNoticeResult("catalog-invalid");
  }

  let result: Awaited<ReturnType<typeof deleteMarketplaceListing>>;

  try {
    result = await deleteMarketplaceListing(parsed.data);
  } catch {
    return marketplaceNoticeResult("catalog-error");
  }

  if (!result.ok) {
    return marketplaceNoticeResult(
      getMarketplaceCatalogFailureNotice(result.reason),
    );
  }

  revalidateMarketplacePaths(result.revalidatePublicCatalog);
  return marketplaceNoticeResult("listing-deleted");
}

export async function createMarketplaceListingVariantAction(
  formData: FormData,
) {
  await requireChairSession();

  let result;

  try {
    result = await createMarketplaceListingVariant({
      listingId: formData.get("listingId"),
      label: formData.get("label"),
      sku: formData.get("sku"),
      unitAmount: formData.get("unitAmount"),
      currency: formData.get("currency"),
      inventoryQuantity: formData.get("inventoryQuantity"),
      isActive: formData.get("isActive"),
      sortOrder: formData.get("sortOrder"),
    });
  } catch {
    redirectToMarketplaceNotice("catalog-error");
  }

  if (!result.ok) {
    redirectToMarketplaceNotice(
      getMarketplaceCatalogFailureNotice(result.reason),
    );
  }

  revalidateMarketplacePaths(result.revalidatePublicCatalog);
  redirectToMarketplaceNotice("variant-created");
}

export async function updateMarketplaceListingVariantAction(
  formData: FormData,
) {
  await requireChairSession();

  let result;

  try {
    result = await updateMarketplaceListingVariant({
      variantId: formData.get("variantId"),
      listingId: formData.get("listingId"),
      label: formData.get("label"),
      sku: formData.get("sku"),
      unitAmount: formData.get("unitAmount"),
      currency: formData.get("currency"),
      inventoryQuantity: formData.get("inventoryQuantity"),
      isActive: formData.get("isActive"),
      sortOrder: formData.get("sortOrder"),
    });
  } catch {
    redirectToMarketplaceNotice("catalog-error");
  }

  if (!result.ok) {
    redirectToMarketplaceNotice(
      getMarketplaceCatalogFailureNotice(result.reason),
    );
  }

  revalidateMarketplacePaths(result.revalidatePublicCatalog);
  redirectToMarketplaceNotice("variant-updated");
}
