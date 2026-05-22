import {
  archiveMarketplaceListingAction,
  createMarketplaceListingAction,
  deleteArchivedMarketplaceListingAction,
  publishMarketplaceListingAction,
  restoreMarketplaceListingAction,
  saveMarketplaceListingAction,
  updateMarketplaceFulfillmentStatusAction,
} from "@/app/actions/marketplace";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  archiveMarketplaceListing,
  createMarketplaceListing,
  createMarketplaceListingVariant,
  deleteArchivedMarketplaceListing,
  verifyChairToken,
  cookies,
  publishMarketplaceListing,
  redirect,
  revalidatePath,
  restoreMarketplaceListing,
  saveMarketplaceListing,
  unpublishMarketplaceListing,
  updateMarketplaceListing,
  updateMarketplaceListingVariant,
  updateMarketplaceOrderFulfillmentStatus,
} = vi.hoisted(() => ({
  archiveMarketplaceListing: vi.fn(),
  createMarketplaceListing: vi.fn(),
  createMarketplaceListingVariant: vi.fn(),
  deleteArchivedMarketplaceListing: vi.fn(),
  verifyChairToken: vi.fn(),
  cookies: vi.fn(),
  publishMarketplaceListing: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  revalidatePath: vi.fn(),
  restoreMarketplaceListing: vi.fn(),
  saveMarketplaceListing: vi.fn(),
  unpublishMarketplaceListing: vi.fn(),
  updateMarketplaceListing: vi.fn(),
  updateMarketplaceListingVariant: vi.fn(),
  updateMarketplaceOrderFulfillmentStatus: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  CHAIR_COOKIE: "blarney_chair_session",
  verifyChairToken,
}));

vi.mock("@/lib/marketplaceChair", () => ({
  updateMarketplaceOrderFulfillmentStatus,
}));

vi.mock("@/lib/marketplaceCatalogAdmin", () => ({
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
}));

vi.mock("next/cache", () => ({
  revalidatePath,
}));

vi.mock("next/headers", () => ({
  cookies,
}));

vi.mock("next/navigation", () => ({
  redirect,
}));

function buildMarketplaceFulfillmentFormData(
  nextStatus: "READY" | "FULFILLED" = "READY",
) {
  const formData = new FormData();
  formData.set("orderId", "order-1");
  formData.set("nextStatus", nextStatus);
  return formData;
}

function buildMarketplaceListingFormData() {
  const formData = new FormData();
  formData.set("slug", "hoodie-drop");
  formData.set("title", "Blarney Hoodie");
  formData.set("description", "Heavy fleece");
  formData.set("imageUrl", "/images/hoodie.jpg");
  formData.set("fulfillmentNote", "Pickup at check-in");
  formData.set("sortOrder", "1");
  return formData;
}

function buildMarketplaceListingIdFormData() {
  const formData = new FormData();
  formData.set("listingId", "listing-1");
  return formData;
}

function buildMarketplaceListingSaveFormData() {
  const formData = buildMarketplaceListingFormData();
  formData.set("listingId", "listing-1");
  formData.append("variantId", "variant-1");
  formData.append("variantLabel", "Medium");
  formData.append("variantSku", "HOODIE-M");
  formData.append("variantUnitAmount", "4500");
  formData.append("variantCurrency", "USD");
  formData.append("variantInventoryQuantity", "8");
  formData.append("variantIsActive", "true");
  formData.append("variantSortOrder", "1");
  return formData;
}

beforeEach(() => {
  cookies.mockResolvedValue({
    get: vi.fn().mockReturnValue({ value: "chair-token" }),
  });
  verifyChairToken.mockResolvedValue(true);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("marketplace chair actions", () => {
  it("redirects to chair login when the chair session is missing", async () => {
    verifyChairToken.mockResolvedValue(false);

    await expect(
      updateMarketplaceFulfillmentStatusAction(
        buildMarketplaceFulfillmentFormData(),
      ),
    ).rejects.toThrow("REDIRECT:/chair/login");

    expect(redirect).toHaveBeenCalledWith("/chair/login");
    expect(updateMarketplaceOrderFulfillmentStatus).not.toHaveBeenCalled();
  });

  it("redirects back with an error notice when the submitted fulfillment form is invalid", async () => {
    const formData = new FormData();
    formData.set("orderId", "order-1");

    await expect(
      updateMarketplaceFulfillmentStatusAction(formData),
    ).rejects.toThrow(
      "REDIRECT:/chair/marketplace?marketplace=transition-error",
    );

    expect(updateMarketplaceOrderFulfillmentStatus).not.toHaveBeenCalled();
  });

  it("revalidates the marketplace chair page and redirects with a fulfillment success notice", async () => {
    updateMarketplaceOrderFulfillmentStatus.mockResolvedValue({
      ok: true,
      orderId: "order-1",
      status: "READY",
    });

    await expect(
      updateMarketplaceFulfillmentStatusAction(
        buildMarketplaceFulfillmentFormData("READY"),
      ),
    ).rejects.toThrow("REDIRECT:/chair/marketplace?marketplace=ready");

    expect(updateMarketplaceOrderFulfillmentStatus).toHaveBeenCalledWith({
      orderId: "order-1",
      nextStatus: "READY",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/chair/marketplace");
  });

  it("redirects back with an error notice when the fulfillment transition is rejected", async () => {
    updateMarketplaceOrderFulfillmentStatus.mockResolvedValue({
      ok: false,
      reason: "invalid_transition",
    });

    await expect(
      updateMarketplaceFulfillmentStatusAction(
        buildMarketplaceFulfillmentFormData("FULFILLED"),
      ),
    ).rejects.toThrow(
      "REDIRECT:/chair/marketplace?marketplace=transition-error",
    );

    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("redirects with a safe duplicate-slug notice when listing creation is rejected", async () => {
    createMarketplaceListing.mockResolvedValue({
      ok: false,
      reason: "duplicate_slug",
    });

    await expect(
      createMarketplaceListingAction(buildMarketplaceListingFormData()),
    ).rejects.toThrow(
      "REDIRECT:/chair/marketplace?marketplace=catalog-duplicate-slug",
    );

    expect(createMarketplaceListing).toHaveBeenCalledWith({
      slug: "hoodie-drop",
      title: "Blarney Hoodie",
      description: "Heavy fleece",
      imageUrl: "/images/hoodie.jpg",
      fulfillmentNote: "Pickup at check-in",
      sortOrder: "1",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("saves listing details and variant edits together with one chair action", async () => {
    saveMarketplaceListing.mockResolvedValue({
      ok: true,
      entityId: "listing-1",
      revalidatePublicCatalog: false,
    });

    await expect(
      saveMarketplaceListingAction(buildMarketplaceListingSaveFormData()),
    ).rejects.toThrow(
      "REDIRECT:/chair/marketplace?marketplace=listing-updated",
    );

    expect(saveMarketplaceListing).toHaveBeenCalledWith({
      description: "Heavy fleece",
      fulfillmentNote: "Pickup at check-in",
      imageUrl: "/images/hoodie.jpg",
      listingId: "listing-1",
      newVariant: undefined,
      removedVariantIds: [],
      slug: "hoodie-drop",
      sortOrder: "1",
      title: "Blarney Hoodie",
      variants: [
        {
          currency: "USD",
          inventoryQuantity: "8",
          isActive: "true",
          label: "Medium",
          sku: "HOODIE-M",
          sortOrder: "1",
          unitAmount: "4500",
          variantId: "variant-1",
        },
      ],
    });
  });

  it("passes explicitly removed variant ids through the combined chair action", async () => {
    const formData = buildMarketplaceListingSaveFormData();
    formData.append("removeVariantId", "variant-2");

    saveMarketplaceListing.mockResolvedValue({
      ok: true,
      entityId: "listing-1",
      revalidatePublicCatalog: false,
    });

    await expect(saveMarketplaceListingAction(formData)).rejects.toThrow(
      "REDIRECT:/chair/marketplace?marketplace=listing-updated",
    );

    expect(saveMarketplaceListing).toHaveBeenCalledWith({
      description: "Heavy fleece",
      fulfillmentNote: "Pickup at check-in",
      imageUrl: "/images/hoodie.jpg",
      listingId: "listing-1",
      newVariant: undefined,
      removedVariantIds: ["variant-2"],
      slug: "hoodie-drop",
      sortOrder: "1",
      title: "Blarney Hoodie",
      variants: [
        {
          currency: "USD",
          inventoryQuantity: "8",
          isActive: "true",
          label: "Medium",
          sku: "HOODIE-M",
          sortOrder: "1",
          unitAmount: "4500",
          variantId: "variant-1",
        },
      ],
    });
  });

  it("revalidates the chair and public marketplace when a listing is published", async () => {
    publishMarketplaceListing.mockResolvedValue({
      ok: true,
      entityId: "listing-1",
      revalidatePublicCatalog: true,
      status: "ACTIVE",
    });

    await expect(
      publishMarketplaceListingAction(buildMarketplaceListingIdFormData()),
    ).rejects.toThrow(
      "REDIRECT:/chair/marketplace?marketplace=listing-published",
    );

    expect(publishMarketplaceListing).toHaveBeenCalledWith({
      listingId: "listing-1",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/chair/marketplace");
    expect(revalidatePath).toHaveBeenCalledWith("/marketplace");
  });

  it("revalidates the chair and public marketplace when an active listing is archived", async () => {
    archiveMarketplaceListing.mockResolvedValue({
      ok: true,
      entityId: "listing-1",
      revalidatePublicCatalog: true,
      status: "ARCHIVED",
    });

    await expect(
      archiveMarketplaceListingAction(buildMarketplaceListingIdFormData()),
    ).rejects.toThrow(
      "REDIRECT:/chair/marketplace?marketplace=listing-archived",
    );

    expect(archiveMarketplaceListing).toHaveBeenCalledWith({
      listingId: "listing-1",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/chair/marketplace");
    expect(revalidatePath).toHaveBeenCalledWith("/marketplace");
  });

  it("revalidates only the chair marketplace when an archived listing is restored to draft", async () => {
    restoreMarketplaceListing.mockResolvedValue({
      ok: true,
      entityId: "listing-1",
      revalidatePublicCatalog: false,
      status: "DRAFT",
    });

    await expect(
      restoreMarketplaceListingAction(buildMarketplaceListingIdFormData()),
    ).rejects.toThrow(
      "REDIRECT:/chair/marketplace?marketplace=listing-restored",
    );

    expect(restoreMarketplaceListing).toHaveBeenCalledWith({
      listingId: "listing-1",
    });
    expect(revalidatePath).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith("/chair/marketplace");
  });

  it("revalidates only the chair marketplace when an archived listing is deleted", async () => {
    deleteArchivedMarketplaceListing.mockResolvedValue({
      ok: true,
      entityId: "listing-1",
      revalidatePublicCatalog: false,
    });

    await expect(
      deleteArchivedMarketplaceListingAction(
        buildMarketplaceListingIdFormData(),
      ),
    ).rejects.toThrow(
      "REDIRECT:/chair/marketplace?marketplace=listing-deleted",
    );

    expect(deleteArchivedMarketplaceListing).toHaveBeenCalledWith({
      listingId: "listing-1",
    });
    expect(revalidatePath).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith("/chair/marketplace");
  });
});
