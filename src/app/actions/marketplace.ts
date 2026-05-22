"use server";

import { CHAIR_COOKIE, verifyChairToken } from "@/lib/auth";
import {
  archiveMarketplaceListing,
  createMarketplaceListing,
  createMarketplaceListingVariant,
  deleteArchivedMarketplaceListing,
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

function getMarketplaceDraftVariantInput(formData: FormData) {
  const newVariant = {
    currency: formData.get("newVariantCurrency"),
    inventoryQuantity: formData.get("newVariantInventoryQuantity"),
    isActive: formData.get("newVariantIsActive"),
    label: formData.get("newVariantLabel"),
    sku: formData.get("newVariantSku"),
    sortOrder: formData.get("newVariantSortOrder"),
    unitAmount: formData.get("newVariantUnitAmount"),
  };

  return Object.values(newVariant).some((value) =>
    hasMarketplaceFormValue(value),
  )
    ? newVariant
    : undefined;
}

export async function updateMarketplaceFulfillmentStatusAction(
  formData: FormData,
) {
  await requireChairSession();

  const parsed = marketplaceFulfillmentActionSchema.safeParse({
    orderId: formData.get("orderId"),
    nextStatus: formData.get("nextStatus"),
  });

  if (!parsed.success) {
    redirect(`${chairMarketplacePath}?marketplace=transition-error`);
  }

  let result;

  try {
    result = await updateMarketplaceOrderFulfillmentStatus(parsed.data);
  } catch {
    redirect(`${chairMarketplacePath}?marketplace=transition-error`);
  }

  if (!result.ok) {
    redirect(`${chairMarketplacePath}?marketplace=transition-error`);
  }

  revalidatePath(chairMarketplacePath);
  redirect(
    `${chairMarketplacePath}?marketplace=${getMarketplaceTransitionNotice(result.status)}`,
  );
}

export async function createMarketplaceListingAction(formData: FormData) {
  await requireChairSession();

  let result;

  try {
    result = await createMarketplaceListing({
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
  redirectToMarketplaceNotice("listing-created");
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

export async function saveMarketplaceListingAction(formData: FormData) {
  await requireChairSession();

  let result;

  try {
    result = await saveMarketplaceListing({
      description: formData.get("description"),
      fulfillmentNote: formData.get("fulfillmentNote"),
      imageUrl: formData.get("imageUrl"),
      listingId: formData.get("listingId"),
      newVariant: getMarketplaceDraftVariantInput(formData),
      removedVariantIds: getMarketplaceRemovedVariantIds(formData),
      slug: formData.get("slug"),
      sortOrder: formData.get("sortOrder"),
      title: formData.get("title"),
      variants: getMarketplaceVariantFormEntries(formData),
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

export async function publishMarketplaceListingAction(formData: FormData) {
  await requireChairSession();

  const parsed = marketplaceListingIdActionSchema.safeParse({
    listingId: formData.get("listingId"),
  });

  if (!parsed.success) {
    redirectToMarketplaceNotice("catalog-invalid");
  }

  let result;

  try {
    result = await publishMarketplaceListing(parsed.data);
  } catch {
    redirectToMarketplaceNotice("catalog-error");
  }

  if (!result.ok) {
    redirectToMarketplaceNotice(
      getMarketplaceCatalogFailureNotice(result.reason),
    );
  }

  revalidateMarketplacePaths(result.revalidatePublicCatalog);
  redirectToMarketplaceNotice("listing-published");
}

export async function unpublishMarketplaceListingAction(formData: FormData) {
  await requireChairSession();

  const parsed = marketplaceListingIdActionSchema.safeParse({
    listingId: formData.get("listingId"),
  });

  if (!parsed.success) {
    redirectToMarketplaceNotice("catalog-invalid");
  }

  let result;

  try {
    result = await unpublishMarketplaceListing(parsed.data);
  } catch {
    redirectToMarketplaceNotice("catalog-error");
  }

  if (!result.ok) {
    redirectToMarketplaceNotice(
      getMarketplaceCatalogFailureNotice(result.reason),
    );
  }

  revalidateMarketplacePaths(result.revalidatePublicCatalog);
  redirectToMarketplaceNotice("listing-unpublished");
}

export async function archiveMarketplaceListingAction(formData: FormData) {
  await requireChairSession();

  const parsed = marketplaceListingIdActionSchema.safeParse({
    listingId: formData.get("listingId"),
  });

  if (!parsed.success) {
    redirectToMarketplaceNotice("catalog-invalid");
  }

  let result;

  try {
    result = await archiveMarketplaceListing(parsed.data);
  } catch {
    redirectToMarketplaceNotice("catalog-error");
  }

  if (!result.ok) {
    redirectToMarketplaceNotice(
      getMarketplaceCatalogFailureNotice(result.reason),
    );
  }

  revalidateMarketplacePaths(result.revalidatePublicCatalog);
  redirectToMarketplaceNotice("listing-archived");
}

export async function restoreMarketplaceListingAction(formData: FormData) {
  await requireChairSession();

  const parsed = marketplaceListingIdActionSchema.safeParse({
    listingId: formData.get("listingId"),
  });

  if (!parsed.success) {
    redirectToMarketplaceNotice("catalog-invalid");
  }

  let result;

  try {
    result = await restoreMarketplaceListing(parsed.data);
  } catch {
    redirectToMarketplaceNotice("catalog-error");
  }

  if (!result.ok) {
    redirectToMarketplaceNotice(
      getMarketplaceCatalogFailureNotice(result.reason),
    );
  }

  revalidateMarketplacePaths(result.revalidatePublicCatalog);
  redirectToMarketplaceNotice("listing-restored");
}

export async function deleteArchivedMarketplaceListingAction(
  formData: FormData,
) {
  await requireChairSession();

  const parsed = marketplaceListingIdActionSchema.safeParse({
    listingId: formData.get("listingId"),
  });

  if (!parsed.success) {
    redirectToMarketplaceNotice("catalog-invalid");
  }

  let result;

  try {
    result = await deleteArchivedMarketplaceListing(parsed.data);
  } catch {
    redirectToMarketplaceNotice("catalog-error");
  }

  if (!result.ok) {
    redirectToMarketplaceNotice(
      getMarketplaceCatalogFailureNotice(result.reason),
    );
  }

  revalidateMarketplacePaths(result.revalidatePublicCatalog);
  redirectToMarketplaceNotice("listing-deleted");
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
