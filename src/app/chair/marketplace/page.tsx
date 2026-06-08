import {
  archiveMarketplaceListingAction,
  createMarketplaceListingAction,
  deleteMarketplaceListingAction,
  publishMarketplaceListingAction,
  restoreMarketplaceListingAction,
  saveMarketplaceListingAction,
  unpublishMarketplaceListingAction,
  updateMarketplaceFulfillmentStatusAction,
} from "@/app/actions/marketplace";
import styles from "@/app/chair/chair.module.css";
import { displayValue } from "@/app/chair/display";
import { ConfirmSubmitButton } from "@/app/chair/marketplace/ConfirmSubmitButton";
import { MarketplaceCreateListingPanel } from "@/app/chair/marketplace/MarketplaceCreateListingPanel";
import { MarketplaceListingActionForm } from "@/app/chair/marketplace/MarketplaceListingActionForm";
import { MarketplaceListingForm } from "@/app/chair/marketplace/MarketplaceListingForm";
import { MarketplaceListingVariantsEditor } from "@/app/chair/marketplace/MarketplaceListingVariantsEditor";
import { PreviewDetailCard } from "@/app/chair/PreviewDetailCard";
import { requireChairPageAuth } from "@/lib/chairAuth.server";
import { formatDateTime } from "@/lib/format";
import {
  getChairMarketplaceCatalog,
  type ChairMarketplaceCatalogListing,
} from "@/lib/marketplaceCatalogAdmin";
import {
  getChairMarketplaceOverview,
  type ChairMarketplaceLineItem,
  type ChairMarketplaceOrderEntry,
  type ChairMarketplaceReviewEntry,
} from "@/lib/marketplaceChair";
import { resolveMarketplaceListingImageUrl } from "@/lib/marketplaceListingImage";

export const dynamic = "force-dynamic";

type SearchParamsRecord = Record<string, string | string[] | undefined>;

type ChairMarketplacePageProps = {
  searchParams?: Promise<SearchParamsRecord | undefined>;
};

type MarketplaceNotice = {
  tone: "success" | "error";
  title: string;
  body: string;
};

type MarketplaceTab = "fulfillment" | "catalog";

type MarketplaceSectionLink = {
  id: string;
  label: string;
};

const FULFILLMENT_SECTION_LINKS: MarketplaceSectionLink[] = [
  { id: "marketplace-operations-snapshot", label: "Operations snapshot" },
  { id: "marketplace-needs-review", label: "Needs review" },
  { id: "marketplace-fulfillment-queue", label: "Fulfillment queue" },
  { id: "marketplace-recently-fulfilled", label: "Recently fulfilled" },
];

const CATALOG_SECTION_LINKS: MarketplaceSectionLink[] = [
  { id: "marketplace-create-draft-listing", label: "Create draft listing" },
  { id: "marketplace-draft-listings", label: "Draft listings" },
  { id: "marketplace-published-listings", label: "Published listings" },
  { id: "marketplace-archived-listings", label: "Archived listings" },
];

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getMarketplaceNotice(
  value: string | string[] | undefined,
): MarketplaceNotice | null {
  switch (getParam(value)) {
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

function getDefaultMarketplaceTab(
  noticeValue: string | string[] | undefined,
): MarketplaceTab {
  switch (getParam(noticeValue)) {
    case "listing-created":
    case "listing-updated":
    case "listing-published":
    case "listing-unpublished":
    case "listing-archived":
    case "listing-restored":
    case "listing-deleted":
    case "variant-created":
    case "variant-updated":
    case "catalog-duplicate-slug":
    case "catalog-duplicate-sku":
    case "catalog-duplicate-variant-label":
    case "catalog-requires-active-variant":
    case "catalog-not-found":
    case "catalog-invalid":
    case "catalog-error":
      return "catalog";
    default:
      return "fulfillment";
  }
}

function getMarketplaceTab(
  tabValue: string | string[] | undefined,
  noticeValue: string | string[] | undefined,
): MarketplaceTab {
  const tab = getParam(tabValue);

  if (tab === "fulfillment" || tab === "catalog") {
    return tab;
  }

  return getDefaultMarketplaceTab(noticeValue);
}

function getMarketplaceTabHref(tab: MarketplaceTab) {
  return tab === "catalog"
    ? "/chair/marketplace?tab=catalog"
    : "/chair/marketplace";
}

function formatCurrency(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

function getBuyerLabel(
  buyerName: string | null,
  buyerEmail: string | null,
  fallback: string,
) {
  return buyerName ?? buyerEmail ?? fallback;
}

function getListingStatusLabel(
  status: ChairMarketplaceCatalogListing["status"],
) {
  switch (status) {
    case "ACTIVE":
      return "Published";
    case "ARCHIVED":
      return "Archived";
    case "DRAFT":
    default:
      return "Draft";
  }
}

function getVariantInventoryLabel(quantity: number | null) {
  if (quantity === null) {
    return "Inventory not tracked";
  }

  return `${quantity} in stock`;
}

function getActiveVariantCount(listing: ChairMarketplaceCatalogListing) {
  return listing.variants.filter((variant) => variant.isActive).length;
}

function isArchivedListing(listing: ChairMarketplaceCatalogListing) {
  return listing.status === "ARCHIVED";
}

function getNextListingSortOrder(listings: ChairMarketplaceCatalogListing[]) {
  return listings.length > 0
    ? Math.max(...listings.map((listing) => listing.sortOrder)) + 1
    : 1;
}

function getNextVariantSortOrder(listing: ChairMarketplaceCatalogListing) {
  return listing.variants.length > 0
    ? Math.max(...listing.variants.map((variant) => variant.sortOrder)) + 1
    : 1;
}

async function loadChairMarketplaceCatalog() {
  try {
    return await getChairMarketplaceCatalog();
  } catch {
    return [] as ChairMarketplaceCatalogListing[];
  }
}

function getPreviewableMarketplaceImageUrl(imageUrl: string | null) {
  const resolvedImageUrl = resolveMarketplaceListingImageUrl(imageUrl);

  if (!resolvedImageUrl) {
    return null;
  }

  const trimmedImageUrl = resolvedImageUrl.trim();

  if (!trimmedImageUrl) {
    return null;
  }

  if (trimmedImageUrl.startsWith("/")) {
    if (trimmedImageUrl.startsWith("//")) {
      return null;
    }

    return trimmedImageUrl;
  }

  try {
    const parsedImageUrl = new URL(trimmedImageUrl);

    return parsedImageUrl.protocol === "https:"
      ? parsedImageUrl.toString()
      : null;
  } catch {
    return null;
  }
}

function renderLineItems(items: ChairMarketplaceLineItem[]) {
  return (
    <div className={styles.detailStack}>
      {items.map((item) => {
        const itemLabel = item.variantLabel
          ? `${item.title} · ${item.variantLabel}`
          : item.title;

        return (
          <div className={styles.detailNotePanel} key={item.id}>
            <p>
              <strong>{itemLabel}</strong>
            </p>
            <p>
              Quantity: {item.quantity} · Line total:{" "}
              {formatCurrency(item.totalAmount, item.currency)}
            </p>
            {item.fulfillmentNote ? <p>{item.fulfillmentNote}</p> : null}
          </div>
        );
      })}
    </div>
  );
}

function renderFulfillmentAction(order: ChairMarketplaceOrderEntry) {
  if (order.fulfillmentStatus === "UNFULFILLED") {
    return (
      <div className={styles.detailStack}>
        <MarketplaceListingActionForm
          action={updateMarketplaceFulfillmentStatusAction}
        >
          <input name="orderId" type="hidden" value={order.id} />
          <input name="nextStatus" type="hidden" value="READY" />
          <button className={styles.secondaryActionButton} type="submit">
            Mark ready
          </button>
        </MarketplaceListingActionForm>
      </div>
    );
  }

  if (order.fulfillmentStatus === "READY") {
    return (
      <div className={styles.detailStack}>
        <MarketplaceListingActionForm
          action={updateMarketplaceFulfillmentStatusAction}
        >
          <input name="orderId" type="hidden" value={order.id} />
          <input name="nextStatus" type="hidden" value="FULFILLED" />
          <button className={styles.secondaryActionButton} type="submit">
            Mark fulfilled
          </button>
        </MarketplaceListingActionForm>
      </div>
    );
  }

  return null;
}

function renderCatalogStatusActions(listing: ChairMarketplaceCatalogListing) {
  return (
    <div className={styles.marketplaceListingActions}>
      <p className={styles.marketplaceListingActionsLabel}>Manage listing</p>
      <div className={styles.detailStack}>
        {listing.status === "ACTIVE" ? (
          <>
            <MarketplaceListingActionForm
              action={unpublishMarketplaceListingAction}
            >
              <input name="listingId" type="hidden" value={listing.id} />
              <button className={styles.secondaryActionButton} type="submit">
                Unpublish to draft
              </button>
            </MarketplaceListingActionForm>
            <MarketplaceListingActionForm
              action={archiveMarketplaceListingAction}
            >
              <input name="listingId" type="hidden" value={listing.id} />
              <button className={styles.secondaryActionButton} type="submit">
                Archive listing
              </button>
            </MarketplaceListingActionForm>
            <MarketplaceListingActionForm
              action={deleteMarketplaceListingAction}
            >
              <input name="listingId" type="hidden" value={listing.id} />
              <ConfirmSubmitButton
                ariaLabel={`Delete published listing ${listing.title}`}
                className={styles.dangerButton}
                confirmMessage="Delete this published listing? It will be removed from the public marketplace. This cannot be undone."
              >
                Delete listing
              </ConfirmSubmitButton>
            </MarketplaceListingActionForm>
          </>
        ) : null}
        {listing.status === "DRAFT" ? (
          <>
            <MarketplaceListingActionForm
              action={publishMarketplaceListingAction}
            >
              <input name="listingId" type="hidden" value={listing.id} />
              <button className={styles.secondaryActionButton} type="submit">
                Publish draft
              </button>
            </MarketplaceListingActionForm>
            <MarketplaceListingActionForm
              action={archiveMarketplaceListingAction}
            >
              <input name="listingId" type="hidden" value={listing.id} />
              <button className={styles.secondaryActionButton} type="submit">
                Archive listing
              </button>
            </MarketplaceListingActionForm>
            <MarketplaceListingActionForm
              action={deleteMarketplaceListingAction}
            >
              <input name="listingId" type="hidden" value={listing.id} />
              <ConfirmSubmitButton
                ariaLabel={`Delete draft listing ${listing.title}`}
                className={styles.dangerButton}
                confirmMessage="Delete this draft listing? This cannot be undone."
              >
                Delete listing
              </ConfirmSubmitButton>
            </MarketplaceListingActionForm>
          </>
        ) : null}
        {listing.status === "ARCHIVED" ? (
          <>
            <MarketplaceListingActionForm
              action={restoreMarketplaceListingAction}
            >
              <input name="listingId" type="hidden" value={listing.id} />
              <button className={styles.secondaryActionButton} type="submit">
                Restore to draft
              </button>
            </MarketplaceListingActionForm>
            <MarketplaceListingActionForm
              action={deleteMarketplaceListingAction}
            >
              <input name="listingId" type="hidden" value={listing.id} />
              <ConfirmSubmitButton
                ariaLabel={`Delete archived listing ${listing.title} permanently`}
                className={styles.dangerButton}
                confirmMessage="Permanently delete this archived listing? This cannot be undone."
              >
                Delete permanently
              </ConfirmSubmitButton>
            </MarketplaceListingActionForm>
          </>
        ) : null}
      </div>
    </div>
  );
}

function CatalogListingCard({
  listing,
}: {
  listing: ChairMarketplaceCatalogListing;
}) {
  const activeVariantCount = getActiveVariantCount(listing);
  const archived = isArchivedListing(listing);
  const nextVariantSortOrder = getNextVariantSortOrder(listing);
  const previewImageUrl = getPreviewableMarketplaceImageUrl(listing.imageUrl);
  const imageAlt = `Preview of ${listing.title}`;

  return (
    <PreviewDetailCard
      actions={renderCatalogStatusActions(listing)}
      eyebrow="Marketplace catalog"
      key={listing.id}
      openLabel={`Open marketplace listing details for ${listing.title}`}
      preview={
        <>
          <div className={styles.marketplaceListingMedia}>
            {previewImageUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={imageAlt}
                  className={`${styles.photoPreview} ${styles.marketplaceListingImage}`}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  src={previewImageUrl}
                />
              </>
            ) : (
              <div
                className={`${styles.placeholderBox} ${styles.marketplaceListingPlaceholder}`}
              >
                No listing image preview
              </div>
            )}
          </div>
          <p className={styles.cardKicker}>
            {getListingStatusLabel(listing.status)}
          </p>
          <h3 className={styles.cardTitle}>{listing.title}</h3>
          <p className={styles.cardMeta}>/{listing.slug}</p>
          <div className={styles.cardMetaGrid}>
            <span className={styles.metric}>
              <span>Variants</span>
              <strong>{listing.variants.length}</strong>
            </span>
            <span className={styles.metric}>
              <span>Active</span>
              <strong>{activeVariantCount}</strong>
            </span>
            <span className={styles.metric}>
              <span>Sort</span>
              <strong>{listing.sortOrder}</strong>
            </span>
            <span className={styles.metric}>
              <span>Updated</span>
              <strong>{formatDateTime(listing.updatedAt)}</strong>
            </span>
          </div>
          <p className={styles.cardText}>
            {listing.description ??
              (archived
                ? "Archived listings stay out of the working catalog until restored to draft."
                : activeVariantCount === 0
                  ? "Add at least one active variant before publishing this listing."
                  : listing.status === "ACTIVE"
                    ? "This listing is live in the shopper catalog."
                    : "This draft is ready for chair review and publishing.")}
          </p>
        </>
      }
      title={listing.title}
    >
      <div className={styles.detailStack}>
        <section className={styles.marketplaceCompartment}>
          <div className={styles.marketplaceCompartmentHeader}>
            <h3 className={styles.marketplaceCompartmentTitle}>Manage listing</h3>
            <p className={styles.marketplaceCompartmentIntro}>
              Change this listing&apos;s status or remove it from the chair
              catalog.
            </p>
          </div>
          {renderCatalogStatusActions(listing)}
        </section>

        <section className={styles.marketplaceCompartment}>
          <div className={styles.marketplaceCompartmentHeader}>
            <h3 className={styles.marketplaceCompartmentTitle}>Overview</h3>
            <p className={styles.marketplaceCompartmentIntro}>
              Read-only snapshot of how this listing currently sits in the
              catalog.
            </p>
          </div>
          <div className={styles.detailGrid}>
            <div className={styles.detailItem}>
              <span>Status</span>
              <p>{getListingStatusLabel(listing.status)}</p>
            </div>
            <div className={styles.detailItem}>
              <span>Slug</span>
              <p>{listing.slug}</p>
            </div>
            <div className={styles.detailItem}>
              <span>Sort order</span>
              <p>{listing.sortOrder}</p>
            </div>
            <div className={styles.detailItem}>
              <span>Active variants</span>
              <p>{activeVariantCount}</p>
            </div>
            <div className={styles.detailItem}>
              <span>Total variants</span>
              <p>{listing.variants.length}</p>
            </div>
            <div className={styles.detailItem}>
              <span>Fulfillment note</span>
              <p>{displayValue(listing.fulfillmentNote)}</p>
            </div>
            <div className={styles.detailItem}>
              <span>Last update</span>
              <p>{formatDateTime(listing.updatedAt)}</p>
            </div>
          </div>
        </section>

        {archived ? (
          <>
            <div className={styles.detailNotePanel}>
              <p>
                <strong>Reference only</strong>
              </p>
              <p>
                Restore this listing to draft before editing details, changing
                variants, or publishing it again.
              </p>
            </div>

            <section className={styles.marketplaceCompartment}>
              <div className={styles.marketplaceCompartmentHeader}>
                <h3 className={styles.marketplaceCompartmentTitle}>Variants</h3>
              </div>
              {listing.variants.length ? (
                <div className={styles.detailStack}>
                  {listing.variants.map((variant) => (
                    <div className={styles.detailNotePanel} key={variant.id}>
                      <p>
                        <strong>{variant.label}</strong>
                      </p>
                      <p>
                        {formatCurrency(variant.unitAmount, variant.currency)} ·{" "}
                        {variant.isActive ? "Active" : "Inactive"} ·{" "}
                        {getVariantInventoryLabel(variant.inventoryQuantity)}
                        {variant.sku ? ` · ${variant.sku}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.emptyState}>
                  No variants are saved on this archived listing.
                </p>
              )}
            </section>
          </>
        ) : (
          <MarketplaceListingForm
            action={saveMarketplaceListingAction}
            fieldId={`listing-image-${listing.id}`}
            initialImageValue={listing.imageUrl}
            pendingSubmitLabel="Saving listing..."
            secondaryChildren={
              <section className={styles.marketplaceCompartment}>
                <div className={styles.marketplaceCompartmentHeader}>
                  <h3 className={styles.marketplaceCompartmentTitle}>
                    Variants
                  </h3>
                  <p className={styles.marketplaceCompartmentIntro}>
                    Existing variant edits and any new variants below save
                    together with this listing.
                  </p>
                </div>
                <MarketplaceListingVariantsEditor
                  defaultCurrency={listing.variants[0]?.currency ?? "USD"}
                  nextVariantSortOrder={nextVariantSortOrder}
                  variants={listing.variants}
                />
              </section>
            }
            submitLabel="Save listing"
            uploadPendingLabel="Uploading image and saving listing..."
          >
            <input name="listingId" type="hidden" value={listing.id} />
            <section className={styles.marketplaceCompartment}>
              <div className={styles.marketplaceCompartmentHeader}>
                <h3 className={styles.marketplaceCompartmentTitle}>
                  Listing details
                </h3>
                <p className={styles.marketplaceCompartmentIntro}>
                  Edit the shopper-facing copy and the listing image.
                </p>
              </div>
              <label className={styles.listControlField}>
                <span>Title</span>
                <input
                  defaultValue={listing.title}
                  name="title"
                  required={true}
                  type="text"
                />
              </label>
              <label className={styles.listControlField}>
                <span>Slug</span>
                <input
                  defaultValue={listing.slug}
                  name="slug"
                  required={true}
                  type="text"
                />
              </label>
              <label className={styles.listControlField}>
                <span>Sort order</span>
                <input
                  defaultValue={listing.sortOrder}
                  min={0}
                  name="sortOrder"
                  type="number"
                />
              </label>
              <label className={styles.listControlField}>
                <span>Description</span>
                <textarea
                  defaultValue={listing.description ?? ""}
                  name="description"
                  rows={4}
                />
              </label>
              <label className={styles.listControlField}>
                <span>Fulfillment note</span>
                <textarea
                  defaultValue={listing.fulfillmentNote ?? ""}
                  name="fulfillmentNote"
                  rows={3}
                />
              </label>
            </section>
          </MarketplaceListingForm>
        )}
      </div>
    </PreviewDetailCard>
  );
}

function ReviewQueueCard({
  checkout,
}: {
  checkout: ChairMarketplaceReviewEntry;
}) {
  const buyerLabel = getBuyerLabel(
    checkout.buyerName,
    checkout.buyerEmail,
    `Checkout ${checkout.id}`,
  );

  return (
    <PreviewDetailCard
      eyebrow="Marketplace review"
      key={checkout.id}
      openLabel={`Open marketplace review details for ${buyerLabel}`}
      preview={
        <>
          <p className={styles.cardKicker}>Needs payment review</p>
          <h3 className={styles.cardTitle}>{buyerLabel}</h3>
          <p className={styles.cardMeta}>{displayValue(checkout.buyerEmail)}</p>
          <div className={styles.cardMetaGrid}>
            <span className={styles.metric}>
              <span>Total</span>
              <strong>
                {formatCurrency(checkout.totalAmount, checkout.currency)}
              </strong>
            </span>
            <span className={styles.metric}>
              <span>Items</span>
              <strong>{checkout.itemCount}</strong>
            </span>
            <span className={styles.metric}>
              <span>Checkout</span>
              <strong>{checkout.checkoutStatus}</strong>
            </span>
            <span className={styles.metric}>
              <span>Payment</span>
              <strong>{displayValue(checkout.paymentStatus)}</strong>
            </span>
          </div>
          <p className={styles.cardText}>
            Review this checkout before it can safely finalize into a
            marketplace order.
          </p>
        </>
      }
      title={buyerLabel}
    >
      <div className={styles.detailStack}>
        <div className={styles.detailGrid}>
          <div className={styles.detailItem}>
            <span>Buyer</span>
            <p>{buyerLabel}</p>
          </div>
          <div className={styles.detailItem}>
            <span>Email</span>
            <p>{displayValue(checkout.buyerEmail)}</p>
          </div>
          <div className={styles.detailItem}>
            <span>Phone</span>
            <p>{displayValue(checkout.phone)}</p>
          </div>
          <div className={styles.detailItem}>
            <span>Created</span>
            <p>{formatDateTime(checkout.createdAt)}</p>
          </div>
          <div className={styles.detailItem}>
            <span>Expires</span>
            <p>{formatDateTime(checkout.expiresAt)}</p>
          </div>
          <div className={styles.detailItem}>
            <span>Payment reference</span>
            <p>{displayValue(checkout.paymentReference)}</p>
          </div>
          <div className={styles.detailItem}>
            <span>Provider order</span>
            <p>{displayValue(checkout.providerOrderId)}</p>
          </div>
          <div className={styles.detailItem}>
            <span>Total</span>
            <p>{formatCurrency(checkout.totalAmount, checkout.currency)}</p>
          </div>
        </div>
        <div className={styles.detailStack}>
          <div className={styles.detailSectionHeader}>
            <h3 className={styles.detailSectionTitle}>Line items</h3>
          </div>
          {renderLineItems(checkout.items)}
        </div>
      </div>
    </PreviewDetailCard>
  );
}

function FulfillmentQueueCard({
  order,
}: {
  order: ChairMarketplaceOrderEntry;
}) {
  const buyerLabel = getBuyerLabel(
    order.buyerName,
    order.buyerEmail,
    `Order ${order.id}`,
  );

  return (
    <PreviewDetailCard
      actions={renderFulfillmentAction(order)}
      eyebrow="Marketplace order"
      key={order.id}
      openLabel={`Open marketplace order details for ${buyerLabel}`}
      preview={
        <>
          <p className={styles.cardKicker}>{order.fulfillmentStatus}</p>
          <h3 className={styles.cardTitle}>{buyerLabel}</h3>
          <p className={styles.cardMeta}>{displayValue(order.buyerEmail)}</p>
          <div className={styles.cardMetaGrid}>
            <span className={styles.metric}>
              <span>Total</span>
              <strong>
                {formatCurrency(order.totalAmount, order.currency)}
              </strong>
            </span>
            <span className={styles.metric}>
              <span>Items</span>
              <strong>{order.itemCount}</strong>
            </span>
            <span className={styles.metric}>
              <span>Confirmed</span>
              <strong>{formatDateTime(order.confirmedAt)}</strong>
            </span>
            <span className={styles.metric}>
              <span>Last update</span>
              <strong>{formatDateTime(order.updatedAt)}</strong>
            </span>
          </div>
          <p className={styles.cardText}>
            Move the order through fulfillment without changing any pricing or
            payment facts.
          </p>
        </>
      }
      title={buyerLabel}
    >
      <div className={styles.detailStack}>
        <div className={styles.detailGrid}>
          <div className={styles.detailItem}>
            <span>Buyer</span>
            <p>{buyerLabel}</p>
          </div>
          <div className={styles.detailItem}>
            <span>Email</span>
            <p>{displayValue(order.buyerEmail)}</p>
          </div>
          <div className={styles.detailItem}>
            <span>Phone</span>
            <p>{displayValue(order.phone)}</p>
          </div>
          <div className={styles.detailItem}>
            <span>Fulfillment</span>
            <p>{order.fulfillmentStatus}</p>
          </div>
          <div className={styles.detailItem}>
            <span>Provider order</span>
            <p>{displayValue(order.providerOrderId)}</p>
          </div>
          <div className={styles.detailItem}>
            <span>Confirmed</span>
            <p>{formatDateTime(order.confirmedAt)}</p>
          </div>
          <div className={styles.detailItem}>
            <span>Last update</span>
            <p>{formatDateTime(order.updatedAt)}</p>
          </div>
          <div className={styles.detailItem}>
            <span>Total</span>
            <p>{formatCurrency(order.totalAmount, order.currency)}</p>
          </div>
        </div>
        <div className={styles.detailStack}>
          <div className={styles.detailSectionHeader}>
            <h3 className={styles.detailSectionTitle}>Line items</h3>
          </div>
          {renderLineItems(order.items)}
        </div>
      </div>
    </PreviewDetailCard>
  );
}

export default async function ChairMarketplacePage({
  searchParams,
}: ChairMarketplacePageProps) {
  await requireChairPageAuth("/chair/marketplace");

  const params = (await searchParams) ?? {};
  const notice = getMarketplaceNotice(params.marketplace);
  const activeTab = getMarketplaceTab(params.tab, params.marketplace);
  const showingFulfillmentTab = activeTab === "fulfillment";
  const activeSectionLinks = showingFulfillmentTab
    ? FULFILLMENT_SECTION_LINKS
    : CATALOG_SECTION_LINKS;
  const sectionNavLabel = showingFulfillmentTab
    ? "Jump to fulfillment sections"
    : "Jump to catalog sections";
  const [overview, catalog] = await Promise.all([
    getChairMarketplaceOverview(),
    loadChairMarketplaceCatalog(),
  ]);
  const nextListingSortOrder = getNextListingSortOrder(catalog);
  const draftCatalog = catalog.filter((listing) => listing.status === "DRAFT");
  const publishedCatalog = catalog.filter(
    (listing) => listing.status === "ACTIVE",
  );
  const archivedCatalog = catalog.filter(
    (listing) => listing.status === "ARCHIVED",
  );

  return (
    <>
      <div className={styles.topline}>
        <div className={styles.pageHeaderCopy}>
          <p className="eyebrow">Private</p>
          <h1>Marketplace</h1>
          <p className={styles.pageIntro}>
            Manage the catalog, review payment exceptions, and move confirmed
            orders through fulfillment without leaving the chair console.
          </p>
          <div className={styles.pageMetaBar}>
            <span className={styles.pageMeta}>
              {draftCatalog.length} draft listing
              {draftCatalog.length === 1 ? "" : "s"}
            </span>
            <span className={styles.pageMeta}>
              {publishedCatalog.length} published listing
              {publishedCatalog.length === 1 ? "" : "s"}
            </span>
            <span className={styles.pageMeta}>
              {archivedCatalog.length} archived listing
              {archivedCatalog.length === 1 ? "" : "s"}
            </span>
            <span className={styles.pageMeta}>
              {overview.activeOrders.length} active fulfillment order
              {overview.activeOrders.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className={styles.marketplaceTabShell}>
            <div className={styles.marketplaceTabHeading}>
              <p className={styles.marketplaceTabEyebrow}>
                Two marketplace tabs
              </p>
              <p className={styles.marketplaceTabIntro}>
                Choose one of the two work areas below before jumping into
                fulfillment or catalog tasks.
              </p>
            </div>
            <nav
              aria-label="Marketplace views"
              className={styles.marketplaceTabNav}
            >
              <a
                aria-current={showingFulfillmentTab ? "page" : undefined}
                className={[
                  styles.marketplaceTabLink,
                  showingFulfillmentTab
                    ? styles.marketplaceTabLinkActive
                    : null,
                ]
                  .filter(Boolean)
                  .join(" ")}
                href={getMarketplaceTabHref("fulfillment")}
              >
                <span className={styles.marketplaceTabKicker}>Tab 1 of 2</span>
                <span
                  className={[
                    styles.marketplaceTabState,
                    showingFulfillmentTab
                      ? styles.marketplaceTabStateActive
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {showingFulfillmentTab ? "Current view" : "Available view"}
                </span>
                <span className={styles.marketplaceTabLabel}>Fulfillment</span>
                <span className={styles.marketplaceTabDescription}>
                  Review checkout exceptions and move confirmed orders through
                  the active queue.
                </span>
              </a>
              <a
                aria-current={!showingFulfillmentTab ? "page" : undefined}
                className={[
                  styles.marketplaceTabLink,
                  !showingFulfillmentTab
                    ? styles.marketplaceTabLinkActive
                    : null,
                ]
                  .filter(Boolean)
                  .join(" ")}
                href={getMarketplaceTabHref("catalog")}
              >
                <span className={styles.marketplaceTabKicker}>Tab 2 of 2</span>
                <span
                  className={[
                    styles.marketplaceTabState,
                    !showingFulfillmentTab
                      ? styles.marketplaceTabStateActive
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {!showingFulfillmentTab ? "Current view" : "Available view"}
                </span>
                <span className={styles.marketplaceTabLabel}>
                  Catalog management
                </span>
                <span className={styles.marketplaceTabDescription}>
                  Create drafts, manage variants, and retire merch drops without
                  crowding the live queue.
                </span>
              </a>
            </nav>
            <div className={styles.marketplaceSectionNavigator}>
              <p className={styles.marketplaceTabEyebrow}>Jump to section</p>
              <nav
                aria-label={sectionNavLabel}
                className={styles.marketplaceSectionNav}
              >
                {activeSectionLinks.map((sectionLink) => (
                  <a
                    className={styles.marketplaceSectionLink}
                    href={`#${sectionLink.id}`}
                    key={sectionLink.id}
                  >
                    {sectionLink.label}
                  </a>
                ))}
              </nav>
            </div>
          </div>
        </div>
      </div>

      {notice ? (
        <section
          className={`${styles.pairingNotice} ${
            notice.tone === "success"
              ? styles.pairingNoticeSuccess
              : styles.pairingNoticeError
          }`}
        >
          <p className={styles.pairingNoticeTitle}>{notice.title}</p>
          <p className={styles.pairingNoticeBody}>{notice.body}</p>
        </section>
      ) : null}

      {showingFulfillmentTab ? (
        <>
          <section
            className={`${styles.sectionBlock} ${styles.marketplaceSection} ${styles.marketplaceJumpTarget}`}
            id="marketplace-operations-snapshot"
          >
            <div className={styles.sectionHeader}>
              <div className={styles.sectionHeading}>
                <h2 className={styles.sectionTitle}>Operations snapshot</h2>
                <p className={styles.sectionIntro}>
                  Review and fulfillment counts stay visible together so chairs
                  can keep the post-payment workload in view before making
                  catalog changes.
                </p>
              </div>
            </div>
            <div className={styles.statGrid}>
              <div className={styles.stat}>
                <span>Needs review</span>
                <strong>{overview.counts.review}</strong>
                <small>Checkouts that need manual chair review.</small>
              </div>
              <div className={styles.stat}>
                <span>Unfulfilled</span>
                <strong>{overview.counts.unfulfilled}</strong>
                <small>Confirmed orders that still need a next step.</small>
              </div>
              <div className={styles.stat}>
                <span>Ready</span>
                <strong>{overview.counts.ready}</strong>
                <small>Orders prepared for pickup or handoff.</small>
              </div>
              <div className={styles.stat}>
                <span>Fulfilled</span>
                <strong>{overview.counts.fulfilled}</strong>
                <small>Completed marketplace orders on record.</small>
              </div>
            </div>
          </section>

          <section
            className={`${styles.sectionBlock} ${styles.marketplaceSection} ${styles.marketplaceJumpTarget}`}
            id="marketplace-needs-review"
          >
            <div className={styles.sectionHeader}>
              <div className={styles.sectionHeading}>
                <h2 className={styles.sectionTitle}>Needs review</h2>
                <p className={styles.sectionIntro}>
                  These checkouts landed in review instead of auto-confirming.
                  Use the buyer and provider references here before resolving
                  them outside the public shopper flow.
                </p>
              </div>
            </div>
            {overview.reviewQueue.length ? (
              <div className={styles.compactCardGrid}>
                {overview.reviewQueue.map((checkout) => (
                  <ReviewQueueCard checkout={checkout} key={checkout.id} />
                ))}
              </div>
            ) : (
              <article className={styles.panel}>
                <p className={styles.emptyState}>
                  Marketplace checkouts that need review will appear here.
                </p>
              </article>
            )}
          </section>

          <section
            className={`${styles.sectionBlock} ${styles.marketplaceSection} ${styles.marketplaceJumpTarget}`}
            id="marketplace-fulfillment-queue"
          >
            <div className={styles.sectionHeader}>
              <div className={styles.sectionHeading}>
                <h2 className={styles.sectionTitle}>Fulfillment queue</h2>
                <p className={styles.sectionIntro}>
                  Only confirmed orders show up here. The available actions stay
                  narrow so fulfillment can move forward without rewriting
                  payment or customer facts.
                </p>
              </div>
            </div>
            {overview.activeOrders.length ? (
              <div className={styles.compactCardGrid}>
                {overview.activeOrders.map((order) => (
                  <FulfillmentQueueCard key={order.id} order={order} />
                ))}
              </div>
            ) : (
              <article className={styles.panel}>
                <p className={styles.emptyState}>
                  Confirmed marketplace orders that still need fulfillment will
                  appear here.
                </p>
              </article>
            )}
          </section>

          <section
            className={`${styles.sectionBlock} ${styles.marketplaceSection} ${styles.marketplaceJumpTarget}`}
            id="marketplace-recently-fulfilled"
          >
            <div className={styles.sectionHeader}>
              <div className={styles.sectionHeading}>
                <h2 className={styles.sectionTitle}>Recently fulfilled</h2>
                <p className={styles.sectionIntro}>
                  Recent history stays visible so chairs can confirm what
                  already moved out of the active queue.
                </p>
              </div>
            </div>
            {overview.recentFulfilledOrders.length ? (
              <div className={styles.compactCardGrid}>
                {overview.recentFulfilledOrders.map((order) => (
                  <FulfillmentQueueCard key={order.id} order={order} />
                ))}
              </div>
            ) : (
              <article className={styles.panel}>
                <p className={styles.emptyState}>
                  Fulfilled marketplace orders will appear here once the queue
                  starts moving.
                </p>
              </article>
            )}
          </section>
        </>
      ) : (
        <section className={styles.sectionBlock}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionHeading}>
              <h2 className={styles.sectionTitle}>Catalog management</h2>
              <p className={styles.sectionIntro}>
                Keep merch editing grouped after the live queues: create drafts,
                publish shopper-ready listings, and keep archived items separate
                from the active chair workflow.
              </p>
            </div>
          </div>

          <article
            className={`${styles.panel} ${styles.marketplaceJumpTarget}`}
            id="marketplace-create-draft-listing"
          >
            <div className={styles.detailStack}>
              <div className={styles.detailSectionHeader}>
                <h3 className={styles.detailSectionTitle}>
                  Create draft listing
                </h3>
                <p className={styles.detailSectionIntro}>
                  New listings stay private until they are published. A listing
                  needs at least one active variant before it can move into the
                  public marketplace.
                </p>
              </div>
              <MarketplaceCreateListingPanel>
                <MarketplaceListingForm
                  action={createMarketplaceListingAction}
                  enableDraftPersistence
                  fieldId="create-listing-image"
                  initialImageValue={null}
                  pendingSubmitLabel="Creating draft listing..."
                  secondaryChildren={
                    <section className={styles.marketplaceCompartment}>
                      <div className={styles.marketplaceCompartmentHeader}>
                        <h3 className={styles.marketplaceCompartmentTitle}>
                          Variants
                        </h3>
                        <p className={styles.marketplaceCompartmentIntro}>
                          Add up to 8 sizes or options now, or after creating the
                          draft.
                        </p>
                      </div>
                      <MarketplaceListingVariantsEditor
                        defaultCurrency="USD"
                        nextVariantSortOrder={1}
                        variants={[]}
                      />
                    </section>
                  }
                  submitLabel="Create draft listing"
                  uploadPendingLabel="Uploading image and creating draft listing..."
                >
                  <label className={styles.listControlField}>
                    <span>Title</span>
                    <input
                      name="title"
                      placeholder="Blarney Hoodie"
                      required={true}
                      type="text"
                    />
                  </label>
                  <label className={styles.listControlField}>
                    <span>Slug</span>
                    <input
                      name="slug"
                      placeholder="blarney-hoodie"
                      required={true}
                      type="text"
                    />
                  </label>
                  <label className={styles.listControlField}>
                    <span>Sort order</span>
                    <input
                      defaultValue={nextListingSortOrder}
                      min={0}
                      name="sortOrder"
                      type="number"
                    />
                  </label>
                  <label className={styles.listControlField}>
                    <span>Description</span>
                    <textarea name="description" rows={4} />
                  </label>
                  <label className={styles.listControlField}>
                    <span>Fulfillment note</span>
                    <textarea name="fulfillmentNote" rows={3} />
                  </label>
                </MarketplaceListingForm>
              </MarketplaceCreateListingPanel>
            </div>
          </article>

          <section
            className={`${styles.detailStack} ${styles.marketplaceSection} ${styles.marketplaceJumpTarget}`}
            id="marketplace-draft-listings"
          >
            <div className={styles.detailSectionHeader}>
              <h3 className={styles.detailSectionTitle}>Draft listings</h3>
            </div>
            <p className={styles.sectionActionHint}>
              Drafts are the working queue for title, copy, variants, and
              inventory before a merch drop goes live.
            </p>
            {draftCatalog.length ? (
              <div className={styles.compactCardGrid}>
                {draftCatalog.map((listing) => (
                  <CatalogListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            ) : (
              <article className={styles.panel}>
                <p className={styles.emptyState}>
                  Draft listings will appear here once you create the next merch
                  drop.
                </p>
              </article>
            )}
          </section>

          <section
            className={`${styles.detailStack} ${styles.marketplaceSection} ${styles.marketplaceJumpTarget}`}
            id="marketplace-published-listings"
          >
            <div className={styles.detailSectionHeader}>
              <h3 className={styles.detailSectionTitle}>Published listings</h3>
            </div>
            <p className={styles.sectionActionHint}>
              Published listings are currently shopper-facing. Unpublish them to
              return to draft, or archive them when the drop is fully retired.
            </p>
            {publishedCatalog.length ? (
              <div className={styles.compactCardGrid}>
                {publishedCatalog.map((listing) => (
                  <CatalogListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            ) : (
              <article className={styles.panel}>
                <p className={styles.emptyState}>
                  Published marketplace listings will appear here.
                </p>
              </article>
            )}
          </section>

          <section
            className={`${styles.detailStack} ${styles.marketplaceSection} ${styles.marketplaceJumpTarget}`}
            id="marketplace-archived-listings"
          >
            <div className={styles.detailSectionHeader}>
              <h3 className={styles.detailSectionTitle}>Archived listings</h3>
            </div>
            <p className={styles.sectionActionHint}>
              Archived listings stay available for reference without crowding
              the active working queues. Restore to draft before editing or
              republishing.
            </p>
            {archivedCatalog.length ? (
              <div className={styles.compactCardGrid}>
                {archivedCatalog.map((listing) => (
                  <CatalogListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            ) : (
              <article className={styles.panel}>
                <p className={styles.emptyState}>
                  Archived marketplace listings will appear here.
                </p>
              </article>
            )}
          </section>
        </section>
      )}
    </>
  );
}
