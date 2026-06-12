import type { ChairNoticeMap } from "@/app/chair/notices/type";

/** Search param that marketplace server actions encode notice codes into. */
export const MARKETPLACE_NOTICE_PARAM = "marketplace";

// Notice copy for chair marketplace actions, keyed by the notice code that
// server actions append to their redirect targets.
export const MARKETPLACE_NOTICES: ChairNoticeMap = {
  ready: {
    tone: "success",
    title: "Marketplace order marked ready.",
    body: "The chair queue now reflects that this order is ready for pickup or handoff.",
  },
  fulfilled: {
    tone: "success",
    title: "Marketplace order marked fulfilled.",
    body: "The order moved out of the active fulfillment queue and into recent history.",
  },
  "transition-error": {
    tone: "error",
    title: "Marketplace order status did not change.",
    body: "Reload and try again. If another chair already moved the order, the queue will refresh to the latest status.",
  },
  "listing-created": {
    tone: "success",
    title: "Marketplace draft listing created.",
    body: "Add variants, inventory, and notes before publishing the drop to shoppers.",
  },
  "listing-updated": {
    tone: "success",
    title: "Marketplace listing updated.",
    body: "Catalog changes are saved and any published shopper view will refresh on the next request.",
  },
  "listing-published": {
    tone: "success",
    title: "Marketplace listing published.",
    body: "This listing is now eligible for the public marketplace as long as it has a purchasable active variant.",
  },
  "listing-unpublished": {
    tone: "success",
    title: "Marketplace listing moved back to draft.",
    body: "Shoppers will no longer see this listing in the active catalog until it is published again.",
  },
  "listing-archived": {
    tone: "success",
    title: "Marketplace listing archived.",
    body: "Archived listings stay out of both the public catalog and the active chair workflow until they are restored to draft.",
  },
  "listing-restored": {
    tone: "success",
    title: "Marketplace listing restored to draft.",
    body: "Review the details, variants, and inventory before publishing this listing again.",
  },
  "listing-deleted": {
    tone: "success",
    title: "Marketplace listing deleted.",
    body: "The listing, its saved variants, and any uploaded listing image were removed from the chair catalog.",
  },
  "variant-created": {
    tone: "success",
    title: "Marketplace variant created.",
    body: "Review the size or option details, then publish when the listing is ready.",
  },
  "variant-updated": {
    tone: "success",
    title: "Marketplace variant updated.",
    body: "Pricing, inventory, and activation changes are now reflected in the chair catalog.",
  },
  "catalog-duplicate-slug": {
    tone: "error",
    title: "Marketplace slug already in use.",
    body: "Choose a different listing slug before saving this merch entry.",
  },
  "catalog-duplicate-sku": {
    tone: "error",
    title: "Marketplace SKU already in use.",
    body: "Each variant SKU must stay unique across the catalog.",
  },
  "catalog-duplicate-variant-label": {
    tone: "error",
    title: "Variant label already exists on this listing.",
    body: "Use a unique size or option label for each variant on the same listing.",
  },
  "catalog-requires-active-variant": {
    tone: "error",
    title: "Publishing requires an active variant.",
    body: "Add at least one active size or option before publishing the listing to the marketplace.",
  },
  "catalog-not-found": {
    tone: "error",
    title: "Marketplace catalog item was not found.",
    body: "Reload the page and try again. Another chair may have changed or removed it.",
  },
  "catalog-invalid": {
    tone: "error",
    title: "Marketplace catalog changes were not saved.",
    body: "Check the submitted fields and try again. Catalog entries need a valid slug, pricing, and sort order.",
  },
  "catalog-error": {
    tone: "error",
    title: "Marketplace catalog update did not finish.",
    body: "Reload and try again. If the issue keeps happening, verify the listing details and variant values.",
  },
};
