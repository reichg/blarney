import {
  archiveMarketplaceListingAction,
  createMarketplaceListingAction,
  deleteMarketplaceListingAction,
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
  deleteMarketplaceListing,
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
  deleteMarketplaceListing: vi.fn(),
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
  deleteMarketplaceListing,
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

function appendNewVariantPanel(
  formData: FormData,
  panel: {
    label?: string;
    sku?: string;
    unitAmount?: string;
    currency?: string;
    inventoryQuantity?: string;
    isActive?: string;
    sortOrder?: string;
  },
) {
  // The chair UI always submits a select-driven default for isActive/currency
  // even on otherwise-blank rows, so mirror that here.
  formData.append("newVariantLabel", panel.label ?? "");
  formData.append("newVariantSku", panel.sku ?? "");
  formData.append("newVariantUnitAmount", panel.unitAmount ?? "");
  formData.append("newVariantCurrency", panel.currency ?? "USD");
  formData.append("newVariantInventoryQuantity", panel.inventoryQuantity ?? "");
  formData.append("newVariantIsActive", panel.isActive ?? "true");
  formData.append("newVariantSortOrder", panel.sortOrder ?? "");
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

  it("returns an error notice url when the submitted fulfillment form is invalid", async () => {
    const formData = new FormData();
    formData.set("orderId", "order-1");

    await expect(
      updateMarketplaceFulfillmentStatusAction(formData),
    ).resolves.toEqual({
      redirectTo: "/chair/marketplace?marketplace=transition-error",
    });

    expect(updateMarketplaceOrderFulfillmentStatus).not.toHaveBeenCalled();
  });

  it("revalidates the marketplace chair page and returns a fulfillment success notice url", async () => {
    updateMarketplaceOrderFulfillmentStatus.mockResolvedValue({
      ok: true,
      orderId: "order-1",
      status: "READY",
    });

    await expect(
      updateMarketplaceFulfillmentStatusAction(
        buildMarketplaceFulfillmentFormData("READY"),
      ),
    ).resolves.toEqual({
      redirectTo: "/chair/marketplace?marketplace=ready",
    });

    expect(updateMarketplaceOrderFulfillmentStatus).toHaveBeenCalledWith({
      orderId: "order-1",
      nextStatus: "READY",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/chair/marketplace");
  });

  it("returns an error notice url when the fulfillment transition is rejected", async () => {
    updateMarketplaceOrderFulfillmentStatus.mockResolvedValue({
      ok: false,
      reason: "invalid_transition",
    });

    await expect(
      updateMarketplaceFulfillmentStatusAction(
        buildMarketplaceFulfillmentFormData("FULFILLED"),
      ),
    ).resolves.toEqual({
      redirectTo: "/chair/marketplace?marketplace=transition-error",
    });

    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("returns a safe duplicate-slug notice url when listing creation is rejected", async () => {
    createMarketplaceListing.mockResolvedValue({
      ok: false,
      reason: "duplicate_slug",
    });

    await expect(
      createMarketplaceListingAction(buildMarketplaceListingFormData()),
    ).resolves.toEqual({
      redirectTo: "/chair/marketplace?marketplace=catalog-duplicate-slug",
    });

    expect(createMarketplaceListing).toHaveBeenCalledWith({
      slug: "hoodie-drop",
      title: "Blarney Hoodie",
      description: "Heavy fleece",
      imageUrl: "/images/hoodie.jpg",
      fulfillmentNote: "Pickup at check-in",
      sortOrder: "1",
      variants: [],
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("forwards parsed draft variants from the create form to the service", async () => {
    const formData = buildMarketplaceListingFormData();
    // A fully blank panel must be dropped, mirroring the save action behavior.
    appendNewVariantPanel(formData, {});
    appendNewVariantPanel(formData, {
      label: "Small",
      sku: "HOODIE-S",
      unitAmount: "4500",
      currency: "USD",
      inventoryQuantity: "3",
      isActive: "true",
      sortOrder: "1",
    });
    appendNewVariantPanel(formData, {
      label: "Medium",
      sku: "HOODIE-M",
      unitAmount: "4500",
      currency: "USD",
      inventoryQuantity: "6",
      isActive: "false",
      sortOrder: "2",
    });

    createMarketplaceListing.mockResolvedValue({
      ok: true,
      entityId: "listing-1",
      revalidatePublicCatalog: false,
    });

    await expect(createMarketplaceListingAction(formData)).resolves.toEqual({
      redirectTo: "/chair/marketplace?marketplace=listing-created",
    });

    expect(createMarketplaceListing).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: "hoodie-drop",
        variants: [
          {
            currency: "USD",
            inventoryQuantity: "3",
            isActive: "true",
            label: "Small",
            sku: "HOODIE-S",
            sortOrder: "1",
            unitAmount: "4500",
          },
          {
            currency: "USD",
            inventoryQuantity: "6",
            isActive: "false",
            label: "Medium",
            sku: "HOODIE-M",
            sortOrder: "2",
            unitAmount: "4500",
          },
        ],
      }),
    );
  });

  it("saves listing details and variant edits together with one chair action", async () => {
    saveMarketplaceListing.mockResolvedValue({
      ok: true,
      entityId: "listing-1",
      revalidatePublicCatalog: false,
    });

    await expect(
      saveMarketplaceListingAction(buildMarketplaceListingSaveFormData()),
    ).resolves.toEqual({
      redirectTo: "/chair/marketplace?marketplace=listing-updated",
    });

    expect(saveMarketplaceListing).toHaveBeenCalledWith({
      description: "Heavy fleece",
      fulfillmentNote: "Pickup at check-in",
      imageUrl: "/images/hoodie.jpg",
      listingId: "listing-1",
      newVariants: [],
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

    await expect(saveMarketplaceListingAction(formData)).resolves.toEqual({
      redirectTo: "/chair/marketplace?marketplace=listing-updated",
    });

    expect(saveMarketplaceListing).toHaveBeenCalledWith({
      description: "Heavy fleece",
      fulfillmentNote: "Pickup at check-in",
      imageUrl: "/images/hoodie.jpg",
      listingId: "listing-1",
      newVariants: [],
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

  it("zips repeated new-variant panel fields into the newVariants array passed to the service", async () => {
    const formData = buildMarketplaceListingSaveFormData();
    appendNewVariantPanel(formData, {
      label: "Large",
      sku: "HOODIE-L",
      unitAmount: "4500",
      currency: "USD",
      inventoryQuantity: "6",
      isActive: "true",
      sortOrder: "2",
    });
    appendNewVariantPanel(formData, {
      label: "Extra Large",
      sku: "HOODIE-XL",
      unitAmount: "4800",
      currency: "USD",
      inventoryQuantity: "4",
      isActive: "false",
      sortOrder: "3",
    });

    saveMarketplaceListing.mockResolvedValue({
      ok: true,
      entityId: "listing-1",
      revalidatePublicCatalog: false,
    });

    await expect(saveMarketplaceListingAction(formData)).resolves.toEqual({
      redirectTo: "/chair/marketplace?marketplace=listing-updated",
    });

    expect(saveMarketplaceListing).toHaveBeenCalledWith(
      expect.objectContaining({
        newVariants: [
          {
            currency: "USD",
            inventoryQuantity: "6",
            isActive: "true",
            label: "Large",
            sku: "HOODIE-L",
            sortOrder: "2",
            unitAmount: "4500",
          },
          {
            currency: "USD",
            inventoryQuantity: "4",
            isActive: "false",
            label: "Extra Large",
            sku: "HOODIE-XL",
            sortOrder: "3",
            unitAmount: "4800",
          },
        ],
      }),
    );
  });

  it("drops fully blank new-variant panels while keeping filled ones", async () => {
    const formData = buildMarketplaceListingSaveFormData();
    // A blank panel only carries the select defaults and must not produce an entry.
    appendNewVariantPanel(formData, {});
    appendNewVariantPanel(formData, {
      label: "Large",
      sku: "HOODIE-L",
      unitAmount: "4500",
      currency: "USD",
      inventoryQuantity: "6",
      isActive: "true",
      sortOrder: "2",
    });

    saveMarketplaceListing.mockResolvedValue({
      ok: true,
      entityId: "listing-1",
      revalidatePublicCatalog: false,
    });

    await expect(saveMarketplaceListingAction(formData)).resolves.toEqual({
      redirectTo: "/chair/marketplace?marketplace=listing-updated",
    });

    expect(saveMarketplaceListing).toHaveBeenCalledWith(
      expect.objectContaining({
        newVariants: [
          {
            currency: "USD",
            inventoryQuantity: "6",
            isActive: "true",
            label: "Large",
            sku: "HOODIE-L",
            sortOrder: "2",
            unitAmount: "4500",
          },
        ],
      }),
    );
  });

  it("passes an empty newVariants array when every submitted panel is blank", async () => {
    const formData = buildMarketplaceListingSaveFormData();
    appendNewVariantPanel(formData, {});

    saveMarketplaceListing.mockResolvedValue({
      ok: true,
      entityId: "listing-1",
      revalidatePublicCatalog: false,
    });

    await expect(saveMarketplaceListingAction(formData)).resolves.toEqual({
      redirectTo: "/chair/marketplace?marketplace=listing-updated",
    });

    expect(saveMarketplaceListing).toHaveBeenCalledWith(
      expect.objectContaining({ newVariants: [] }),
    );
  });

  it("revalidates the chair and public marketplace and returns the published notice url", async () => {
    publishMarketplaceListing.mockResolvedValue({
      ok: true,
      entityId: "listing-1",
      revalidatePublicCatalog: true,
      status: "ACTIVE",
    });

    await expect(
      publishMarketplaceListingAction(buildMarketplaceListingIdFormData()),
    ).resolves.toEqual({
      redirectTo: "/chair/marketplace?marketplace=listing-published",
    });

    expect(publishMarketplaceListing).toHaveBeenCalledWith({
      listingId: "listing-1",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/chair/marketplace");
    expect(revalidatePath).toHaveBeenCalledWith("/marketplace");
  });

  it("revalidates the chair and public marketplace and returns the archived notice url", async () => {
    archiveMarketplaceListing.mockResolvedValue({
      ok: true,
      entityId: "listing-1",
      revalidatePublicCatalog: true,
      status: "ARCHIVED",
    });

    await expect(
      archiveMarketplaceListingAction(buildMarketplaceListingIdFormData()),
    ).resolves.toEqual({
      redirectTo: "/chair/marketplace?marketplace=listing-archived",
    });

    expect(archiveMarketplaceListing).toHaveBeenCalledWith({
      listingId: "listing-1",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/chair/marketplace");
    expect(revalidatePath).toHaveBeenCalledWith("/marketplace");
  });

  it("revalidates only the chair marketplace and returns the restored notice url", async () => {
    restoreMarketplaceListing.mockResolvedValue({
      ok: true,
      entityId: "listing-1",
      revalidatePublicCatalog: false,
      status: "DRAFT",
    });

    await expect(
      restoreMarketplaceListingAction(buildMarketplaceListingIdFormData()),
    ).resolves.toEqual({
      redirectTo: "/chair/marketplace?marketplace=listing-restored",
    });

    expect(restoreMarketplaceListing).toHaveBeenCalledWith({
      listingId: "listing-1",
    });
    expect(revalidatePath).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith("/chair/marketplace");
  });

  it("revalidates only the chair marketplace and returns the deleted notice url for a non-public listing", async () => {
    deleteMarketplaceListing.mockResolvedValue({
      ok: true,
      entityId: "listing-1",
      revalidatePublicCatalog: false,
    });

    await expect(
      deleteMarketplaceListingAction(buildMarketplaceListingIdFormData()),
    ).resolves.toEqual({
      redirectTo: "/chair/marketplace?marketplace=listing-deleted",
    });

    expect(deleteMarketplaceListing).toHaveBeenCalledWith({
      listingId: "listing-1",
    });
    expect(revalidatePath).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith("/chair/marketplace");
  });

  it("revalidates the chair and public marketplace and returns the deleted notice url for a published listing", async () => {
    deleteMarketplaceListing.mockResolvedValue({
      ok: true,
      entityId: "listing-1",
      revalidatePublicCatalog: true,
    });

    await expect(
      deleteMarketplaceListingAction(buildMarketplaceListingIdFormData()),
    ).resolves.toEqual({
      redirectTo: "/chair/marketplace?marketplace=listing-deleted",
    });

    expect(deleteMarketplaceListing).toHaveBeenCalledWith({
      listingId: "listing-1",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/chair/marketplace");
    expect(revalidatePath).toHaveBeenCalledWith("/marketplace");
  });
});
