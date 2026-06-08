// Shared, framework-neutral notice copy for chair marketplace actions. Imported
// by both the server page (top banner for success notices) and the client toast
// (error notices surfaced next to the action wherever the chair is scrolled).

export type MarketplaceNotice = {
  tone: "success" | "error";
  title: string;
  body: string;
};

export function getMarketplaceNoticeContent(
  code: string | undefined,
): MarketplaceNotice | null {
  switch (code) {
    case "ready":
      return {
        tone: "success",
        title: "Marketplace order marked ready.",
        body: "The chair queue now reflects that this order is ready for pickup or handoff.",
      };
    case "fulfilled":
      return {
        tone: "success",
        title: "Marketplace order marked fulfilled.",
        body: "The order moved out of the active fulfillment queue and into recent history.",
      };
    case "transition-error":
      return {
        tone: "error",
        title: "Marketplace order status did not change.",
        body: "Reload and try again. If another chair already moved the order, the queue will refresh to the latest status.",
      };
    case "listing-created":
      return {
        tone: "success",
        title: "Marketplace draft listing created.",
        body: "Add variants, inventory, and notes before publishing the drop to shoppers.",
      };
    case "listing-updated":
      return {
        tone: "success",
        title: "Marketplace listing updated.",
        body: "Catalog changes are saved and any published shopper view will refresh on the next request.",
      };
    case "listing-published":
      return {
        tone: "success",
        title: "Marketplace listing published.",
        body: "This listing is now eligible for the public marketplace as long as it has a purchasable active variant.",
      };
    case "listing-unpublished":
      return {
        tone: "success",
        title: "Marketplace listing moved back to draft.",
        body: "Shoppers will no longer see this listing in the active catalog until it is published again.",
      };
    case "listing-archived":
      return {
        tone: "success",
        title: "Marketplace listing archived.",
        body: "Archived listings stay out of both the public catalog and the active chair workflow until they are restored to draft.",
      };
    case "listing-restored":
      return {
        tone: "success",
        title: "Marketplace listing restored to draft.",
        body: "Review the details, variants, and inventory before publishing this listing again.",
      };
    case "listing-deleted":
      return {
        tone: "success",
        title: "Marketplace listing deleted.",
        body: "The listing, its saved variants, and any uploaded listing image were removed from the chair catalog.",
      };
    case "variant-created":
      return {
        tone: "success",
        title: "Marketplace variant created.",
        body: "Review the size or option details, then publish when the listing is ready.",
      };
    case "variant-updated":
      return {
        tone: "success",
        title: "Marketplace variant updated.",
        body: "Pricing, inventory, and activation changes are now reflected in the chair catalog.",
      };
    case "catalog-duplicate-slug":
      return {
        tone: "error",
        title: "Marketplace slug already in use.",
        body: "Choose a different listing slug before saving this merch entry.",
      };
    case "catalog-duplicate-sku":
      return {
        tone: "error",
        title: "Marketplace SKU already in use.",
        body: "Each variant SKU must stay unique across the catalog.",
      };
    case "catalog-duplicate-variant-label":
      return {
        tone: "error",
        title: "Variant label already exists on this listing.",
        body: "Use a unique size or option label for each variant on the same listing.",
      };
    case "catalog-requires-active-variant":
      return {
        tone: "error",
        title: "Publishing requires an active variant.",
        body: "Add at least one active size or option before publishing the listing to the marketplace.",
      };
    case "catalog-not-found":
      return {
        tone: "error",
        title: "Marketplace catalog item was not found.",
        body: "Reload the page and try again. Another chair may have changed or removed it.",
      };
    case "catalog-invalid":
      return {
        tone: "error",
        title: "Marketplace catalog changes were not saved.",
        body: "Check the submitted fields and try again. Catalog entries need a valid slug, pricing, and sort order.",
      };
    case "catalog-error":
      return {
        tone: "error",
        title: "Marketplace catalog update did not finish.",
        body: "Reload and try again. If the issue keeps happening, verify the listing details and variant values.",
      };
    default:
      return null;
  }
}
