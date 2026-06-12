import ChairMarketplacePage from "@/app/chair/marketplace/page";
import { getMarketplaceListingImageViewPath } from "@/lib/marketplaceListingImage";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const {
  getChairMarketplaceCatalog,
  getChairMarketplaceOverview,
  requireChairPageAuth,
} = vi.hoisted(() => ({
  getChairMarketplaceCatalog: vi.fn(),
  getChairMarketplaceOverview: vi.fn(),
  requireChairPageAuth: vi.fn(async () => undefined),
}));

vi.mock("@/app/actions/marketplace", () => ({
  archiveMarketplaceListingAction: vi.fn(async () => undefined),
  createMarketplaceListingAction: vi.fn(async () => undefined),
  createMarketplaceListingVariantAction: vi.fn(async () => undefined),
  deleteMarketplaceListingAction: vi.fn(async () => undefined),
  publishMarketplaceListingAction: vi.fn(async () => undefined),
  restoreMarketplaceListingAction: vi.fn(async () => undefined),
  saveMarketplaceListingAction: vi.fn(async () => undefined),
  unpublishMarketplaceListingAction: vi.fn(async () => undefined),
  updateMarketplaceFulfillmentStatusAction: vi.fn(async () => undefined),
  updateMarketplaceListingAction: vi.fn(async () => undefined),
  updateMarketplaceListingVariantAction: vi.fn(async () => undefined),
}));

vi.mock("@/app/chair/chair.module.css", () => ({
  default: new Proxy(
    {},
    {
      get: (_, key) => String(key),
    },
  ),
}));

vi.mock("@/app/chair/PreviewDetailCard", () => ({
  PreviewDetailCard: ({
    actions,
    children,
    preview,
  }: {
    actions?: React.ReactNode;
    children: React.ReactNode;
    preview: React.ReactNode;
  }) => createElement("article", null, preview, actions ?? null, children),
}));

vi.mock("@/lib/chairAuth.server", () => ({
  requireChairPageAuth,
}));

vi.mock("@/lib/marketplaceCatalogAdmin", () => ({
  getChairMarketplaceCatalog,
}));

vi.mock("@/lib/format", () => ({
  formatDateTime: (value: Date) => value.toISOString(),
}));

vi.mock("@/lib/marketplaceChair", () => ({
  getChairMarketplaceOverview,
}));

// The catalog view now wraps listing actions in a client component that reads
// useRouter, so the static render needs a mounted-router stub to execute.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("chair marketplace page", () => {
  it.each([
    {
      label: "no tab is selected",
      searchParams: {},
    },
    {
      label: "the tab value is invalid",
      searchParams: { tab: "unknown" },
    },
  ])(
    "requires chair auth and defaults to the fulfillment view when $label",
    async ({ searchParams }) => {
      getChairMarketplaceCatalog.mockResolvedValue([]);
      getChairMarketplaceOverview.mockResolvedValue({
        counts: {
          review: 0,
          unfulfilled: 0,
          ready: 0,
          fulfilled: 0,
        },
        reviewQueue: [],
        activeOrders: [],
        recentFulfilledOrders: [],
      });

      const html = renderToStaticMarkup(
        await ChairMarketplacePage({
          searchParams: Promise.resolve(searchParams),
        }),
      );

      expect(requireChairPageAuth).toHaveBeenCalledWith("/chair/marketplace");
      expect(getChairMarketplaceOverview).toHaveBeenCalled();
      expect(getChairMarketplaceCatalog).toHaveBeenCalled();
      expect(html).toContain("Marketplace");
      expect(html).toContain("Two marketplace tabs");
      expect(html).toContain("Tab 1 of 2");
      expect(html).toContain("Tab 2 of 2");
      expect(html).toContain("Fulfillment");
      expect(html).toContain("Catalog management");
      expect(html).toContain("Current view");
      expect(html).toContain("Available view");
      expect(html).toContain('href="/chair/marketplace"');
      expect(html).toContain('href="/chair/marketplace?tab=catalog"');
      expect(html).toContain('aria-current="page"');
      expect(html).toContain("Operations snapshot");
      expect(html).toContain(
        "Marketplace checkouts that need review will appear here.",
      );
      expect(html).toContain(
        "Confirmed marketplace orders that still need fulfillment will appear here.",
      );
      expect(html).not.toContain("Create draft listing");
      expect(html).not.toContain(
        "Draft listings will appear here once you create the next merch drop.",
      );
    },
  );

  it("renders fulfillment controls from the marketplace overview", async () => {
    getChairMarketplaceCatalog.mockResolvedValue([
      {
        id: "listing-hoodie",
        slug: "hoodie",
        title: "Draft Hoodie",
        description: "Heavy fleece",
        imageUrl: "/images/hoodie.jpg",
        fulfillmentNote: "Pickup at check-in",
        status: "DRAFT",
        sortOrder: 1,
        createdAt: new Date("2026-05-20T11:00:00.000Z"),
        updatedAt: new Date("2026-05-20T12:00:00.000Z"),
        variants: [
          {
            id: "variant-hoodie-m",
            label: "Medium",
            sku: "HOODIE-M",
            unitAmount: 4500,
            currency: "USD",
            inventoryQuantity: 8,
            isActive: true,
            sortOrder: 1,
            createdAt: new Date("2026-05-20T11:00:00.000Z"),
            updatedAt: new Date("2026-05-20T12:00:00.000Z"),
          },
        ],
      },
      {
        id: "listing-tee",
        slug: "tee",
        title: "Live Tee",
        description: "Soft cotton",
        imageUrl: "/images/tee.jpg",
        fulfillmentNote: "Ship after gala",
        status: "ACTIVE",
        sortOrder: 2,
        createdAt: new Date("2026-05-20T11:30:00.000Z"),
        updatedAt: new Date("2026-05-20T12:30:00.000Z"),
        variants: [
          {
            id: "variant-tee-l",
            label: "Large",
            sku: "TEE-L",
            unitAmount: 3000,
            currency: "USD",
            inventoryQuantity: 10,
            isActive: true,
            sortOrder: 1,
            createdAt: new Date("2026-05-20T11:30:00.000Z"),
            updatedAt: new Date("2026-05-20T12:30:00.000Z"),
          },
        ],
      },
      {
        id: "listing-cap",
        slug: "cap",
        title: "Retired Cap",
        description: "Reference item",
        imageUrl: "/images/cap.jpg",
        fulfillmentNote: "No longer sold",
        status: "ARCHIVED",
        sortOrder: 3,
        createdAt: new Date("2026-05-20T10:30:00.000Z"),
        updatedAt: new Date("2026-05-20T11:30:00.000Z"),
        variants: [
          {
            id: "variant-cap-one",
            label: "One Size",
            sku: "CAP-ONE",
            unitAmount: 2200,
            currency: "USD",
            inventoryQuantity: 0,
            isActive: false,
            sortOrder: 1,
            createdAt: new Date("2026-05-20T10:30:00.000Z"),
            updatedAt: new Date("2026-05-20T11:30:00.000Z"),
          },
        ],
      },
    ]);
    getChairMarketplaceOverview.mockResolvedValue({
      counts: {
        review: 1,
        unfulfilled: 1,
        ready: 0,
        fulfilled: 2,
      },
      reviewQueue: [
        {
          id: "checkout-1",
          buyerEmail: "buyer@example.com",
          buyerName: "Pat Buyer",
          phone: "555-0100",
          checkoutStatus: "PAYMENT_REVIEW",
          paymentStatus: "REVIEW",
          paymentReference: "marketplace-link-1",
          providerOrderId: "marketplace-order-1",
          currency: "USD",
          totalAmount: 9000,
          itemCount: 2,
          createdAt: new Date("2026-05-20T12:00:00.000Z"),
          expiresAt: new Date("2026-05-21T12:00:00.000Z"),
          items: [
            {
              id: "checkout-item-1",
              title: "Blarney Hoodie",
              variantLabel: "Medium",
              quantity: 2,
              currency: "USD",
              totalAmount: 9000,
              fulfillmentNote: "Pickup at check-in",
            },
          ],
        },
      ],
      activeOrders: [
        {
          id: "order-1",
          checkoutId: "checkout-1",
          buyerEmail: "buyer@example.com",
          buyerName: "Pat Buyer",
          phone: "555-0100",
          fulfillmentStatus: "UNFULFILLED",
          providerOrderId: "marketplace-order-1",
          currency: "USD",
          totalAmount: 9000,
          itemCount: 2,
          confirmedAt: new Date("2026-05-20T13:00:00.000Z"),
          updatedAt: new Date("2026-05-20T13:00:00.000Z"),
          items: [
            {
              id: "order-item-1",
              title: "Blarney Hoodie",
              variantLabel: "Medium",
              quantity: 2,
              currency: "USD",
              totalAmount: 9000,
              fulfillmentNote: "Pickup at check-in",
            },
          ],
        },
      ],
      recentFulfilledOrders: [],
    });

    const html = renderToStaticMarkup(
      await ChairMarketplacePage({
        searchParams: Promise.resolve({ marketplace: "ready" }),
      }),
    );

    // Action notices are surfaced as a client toast at action time (via
    // useMarketplaceActionNavigation), not as a server-rendered banner, so the
    // notice param must not produce inline notice markup in the page HTML.
    expect(html).not.toContain("Marketplace order marked ready.");
    expect(html).toContain("Operations snapshot");
    expect(html).toContain("Fulfillment queue");
    expect(html).toContain("Pat Buyer");
    expect(html).toContain("Needs payment review");
    expect(html).toContain("Mark ready");
    expect(html).toContain("marketplace-order-1");
    expect(html).not.toContain("Create draft listing");
    expect(html).not.toContain("Draft Hoodie");
  });

  it.each([
    {
      label: "the catalog tab is selected",
      searchParams: { tab: "catalog" },
      noticeTitle: null,
    },
    {
      label: "a catalog action returns a notice",
      searchParams: { marketplace: "listing-created" },
      noticeTitle: "Marketplace draft listing created.",
    },
    {
      label: "a listing is deleted",
      searchParams: { marketplace: "listing-deleted" },
      noticeTitle: "Marketplace listing deleted.",
    },
  ])(
    "renders the catalog view when $label",
    async ({ noticeTitle, searchParams }) => {
      getChairMarketplaceCatalog.mockResolvedValue([
        {
          id: "listing-hoodie",
          slug: "hoodie",
          title: "Draft Hoodie",
          description: "Heavy fleece",
          imageUrl: "/images/hoodie.jpg",
          fulfillmentNote: "Pickup at check-in",
          status: "DRAFT",
          sortOrder: 1,
          createdAt: new Date("2026-05-20T11:00:00.000Z"),
          updatedAt: new Date("2026-05-20T12:00:00.000Z"),
          variants: [
            {
              id: "variant-hoodie-m",
              label: "Medium",
              sku: "HOODIE-M",
              unitAmount: 4500,
              currency: "USD",
              inventoryQuantity: 8,
              isActive: true,
              sortOrder: 1,
              createdAt: new Date("2026-05-20T11:00:00.000Z"),
              updatedAt: new Date("2026-05-20T12:00:00.000Z"),
            },
          ],
        },
        {
          id: "listing-tee",
          slug: "tee",
          title: "Live Tee",
          description: "Soft cotton",
          imageUrl: "/images/tee.jpg",
          fulfillmentNote: "Ship after gala",
          status: "ACTIVE",
          sortOrder: 2,
          createdAt: new Date("2026-05-20T11:30:00.000Z"),
          updatedAt: new Date("2026-05-20T12:30:00.000Z"),
          variants: [
            {
              id: "variant-tee-l",
              label: "Large",
              sku: "TEE-L",
              unitAmount: 3000,
              currency: "USD",
              inventoryQuantity: 10,
              isActive: true,
              sortOrder: 1,
              createdAt: new Date("2026-05-20T11:30:00.000Z"),
              updatedAt: new Date("2026-05-20T12:30:00.000Z"),
            },
          ],
        },
        {
          id: "listing-cap",
          slug: "cap",
          title: "Retired Cap",
          description: "Reference item",
          imageUrl: "/images/cap.jpg",
          fulfillmentNote: "No longer sold",
          status: "ARCHIVED",
          sortOrder: 3,
          createdAt: new Date("2026-05-20T10:30:00.000Z"),
          updatedAt: new Date("2026-05-20T11:30:00.000Z"),
          variants: [
            {
              id: "variant-cap-one",
              label: "One Size",
              sku: "CAP-ONE",
              unitAmount: 2200,
              currency: "USD",
              inventoryQuantity: 0,
              isActive: false,
              sortOrder: 1,
              createdAt: new Date("2026-05-20T10:30:00.000Z"),
              updatedAt: new Date("2026-05-20T11:30:00.000Z"),
            },
          ],
        },
      ]);
      getChairMarketplaceOverview.mockResolvedValue({
        counts: {
          review: 1,
          unfulfilled: 1,
          ready: 0,
          fulfilled: 2,
        },
        reviewQueue: [
          {
            id: "checkout-1",
            buyerEmail: "buyer@example.com",
            buyerName: "Pat Buyer",
            phone: "555-0100",
            checkoutStatus: "PAYMENT_REVIEW",
            paymentStatus: "REVIEW",
            paymentReference: "marketplace-link-1",
            providerOrderId: "marketplace-order-1",
            currency: "USD",
            totalAmount: 9000,
            itemCount: 2,
            createdAt: new Date("2026-05-20T12:00:00.000Z"),
            expiresAt: new Date("2026-05-21T12:00:00.000Z"),
            items: [
              {
                id: "checkout-item-1",
                title: "Blarney Hoodie",
                variantLabel: "Medium",
                quantity: 2,
                currency: "USD",
                totalAmount: 9000,
                fulfillmentNote: "Pickup at check-in",
              },
            ],
          },
        ],
        activeOrders: [
          {
            id: "order-1",
            checkoutId: "checkout-1",
            buyerEmail: "buyer@example.com",
            buyerName: "Pat Buyer",
            phone: "555-0100",
            fulfillmentStatus: "UNFULFILLED",
            providerOrderId: "marketplace-order-1",
            currency: "USD",
            totalAmount: 9000,
            itemCount: 2,
            confirmedAt: new Date("2026-05-20T13:00:00.000Z"),
            updatedAt: new Date("2026-05-20T13:00:00.000Z"),
            items: [
              {
                id: "order-item-1",
                title: "Blarney Hoodie",
                variantLabel: "Medium",
                quantity: 2,
                currency: "USD",
                totalAmount: 9000,
                fulfillmentNote: "Pickup at check-in",
              },
            ],
          },
        ],
        recentFulfilledOrders: [],
      });

      const html = renderToStaticMarkup(
        await ChairMarketplacePage({
          searchParams: Promise.resolve(searchParams),
        }),
      );

      if (noticeTitle) {
        // The notice param still drives the catalog tab default (asserted
        // below) but its copy is surfaced as a client toast at action time,
        // never as inline banner markup in the server-rendered page.
        expect(html).not.toContain(noticeTitle);
      }

      expect(html).toContain(
        'aria-current="page" class="marketplaceTabLink marketplaceTabLinkActive" href="/chair/marketplace?tab=catalog"',
      );
      expect(html).toContain(
        'href="/chair/marketplace?tab=catalog"><span class="marketplaceTabKicker">Tab 2 of 2</span><span class="marketplaceTabState marketplaceTabStateActive">Current view</span>',
      );
      expect(html).toContain(
        'href="/chair/marketplace"><span class="marketplaceTabKicker">Tab 1 of 2</span><span class="marketplaceTabState">Available view</span>',
      );
      expect(html).not.toContain(
        'aria-current="page" class="marketplaceTabLink marketplaceTabLinkActive" href="/chair/marketplace"',
      );
      expect(html).toContain("Create draft listing");
      expect(html).toContain("Draft listings");
      expect(html).toContain("Published listings");
      expect(html).toContain("Archived listings");
      expect(html).toContain("Draft Hoodie");
      expect(html).toContain("Live Tee");
      expect(html).toContain("Retired Cap");
      expect(html).not.toContain("Image review");
      expect(html).toContain("Overview");
      expect(html).toContain("Listing details");
      expect(html).toContain("Listing image");
      expect(html).toContain("The file uploads when you save the listing.");
      expect(html).toContain("HOODIE-M");
      expect(html).toContain('alt="Preview of Draft Hoodie"');
      expect(html).toContain('src="/images/hoodie.jpg"');
      expect(html).toContain('class="actionButton fullWidthButton"');
      expect(html).not.toContain("Image URL");
      expect(html).toContain("Delete variant");
      expect(html).toContain("Add variant");
      expect(html).toContain("Delete permanently");
      // Every status now exposes a delete control. Draft and active listings
      // use the generalized "Delete listing" label while archived keeps its
      // existing "Delete permanently" copy asserted above.
      expect(html).toContain("Delete listing");
      expect(html).toContain('aria-label="Delete draft listing Draft Hoodie"');
      expect(html).toContain(
        'aria-label="Delete published listing Live Tee"',
      );
      expect(html).toContain(
        'aria-label="Delete archived listing Retired Cap permanently"',
      );
      // Status actions also render inside the detail dialog content, not only in
      // the card actions slot. The PreviewDetailCard mock renders children, so
      // the "Manage listing" section is present in the static markup.
      expect(html).toContain("Manage listing");
      expect(html).toContain(" status or remove it from the chair");
      expect(html).not.toContain("Upload selected image");
      expect(html).not.toContain(
        "Remove this variant when you save the listing",
      );
      expect(html).not.toContain("Save variant");
      expect(html).not.toContain('name="newVariantLabel"');
      expect(html).not.toContain("Operations snapshot");
      expect(html).not.toContain("Needs payment review");
      expect(html).not.toContain("Mark ready");
    },
  );

  it("shows a placeholder instead of rendering untrusted listing image urls", async () => {
    getChairMarketplaceCatalog.mockResolvedValue([
      {
        id: "listing-badge",
        slug: "badge",
        title: "Badge",
        description: "Volunteer badge",
        imageUrl: "javascript:alert(1)",
        fulfillmentNote: null,
        status: "DRAFT",
        sortOrder: 1,
        createdAt: new Date("2026-05-20T11:00:00.000Z"),
        updatedAt: new Date("2026-05-20T12:00:00.000Z"),
        variants: [],
      },
      {
        id: "listing-banner",
        slug: "banner",
        title: "Banner",
        description: "Event banner",
        imageUrl: "//tracker.example.com/banner.png",
        fulfillmentNote: null,
        status: "DRAFT",
        sortOrder: 2,
        createdAt: new Date("2026-05-20T11:30:00.000Z"),
        updatedAt: new Date("2026-05-20T12:30:00.000Z"),
        variants: [],
      },
    ]);
    getChairMarketplaceOverview.mockResolvedValue({
      counts: {
        review: 0,
        unfulfilled: 0,
        ready: 0,
        fulfilled: 0,
      },
      reviewQueue: [],
      activeOrders: [],
      recentFulfilledOrders: [],
    });

    const html = renderToStaticMarkup(
      await ChairMarketplacePage({
        searchParams: Promise.resolve({ tab: "catalog" }),
      }),
    );

    expect(html).toContain("No listing image preview");
    expect(html).not.toContain('src="javascript:alert(1)"');
    expect(html).not.toContain('src="//tracker.example.com/banner.png"');
  });

  it("renders managed listing image keys through the marketplace listing image route", async () => {
    const managedImageKey =
      "listing/123e4567-e89b-12d3-a456-426614174000-hoodie.png";

    getChairMarketplaceCatalog.mockResolvedValue([
      {
        id: "listing-hoodie",
        slug: "hoodie",
        title: "Draft Hoodie",
        description: "Heavy fleece",
        imageUrl: managedImageKey,
        fulfillmentNote: "Pickup at check-in",
        status: "DRAFT",
        sortOrder: 1,
        createdAt: new Date("2026-05-20T11:00:00.000Z"),
        updatedAt: new Date("2026-05-20T12:00:00.000Z"),
        variants: [],
      },
    ]);
    getChairMarketplaceOverview.mockResolvedValue({
      counts: {
        review: 0,
        unfulfilled: 0,
        ready: 0,
        fulfilled: 0,
      },
      reviewQueue: [],
      activeOrders: [],
      recentFulfilledOrders: [],
    });

    const html = renderToStaticMarkup(
      await ChairMarketplacePage({
        searchParams: Promise.resolve({ tab: "catalog" }),
      }),
    );

    expect(html).toContain(
      `src="${getMarketplaceListingImageViewPath(managedImageKey)}"`,
    );
  });

  it("renders archived listings as reference-only without edit controls", async () => {
    getChairMarketplaceCatalog.mockResolvedValue([
      {
        id: "listing-cap",
        slug: "cap",
        title: "Retired Cap",
        description: "Reference item",
        imageUrl: "/images/cap.jpg",
        fulfillmentNote: "No longer sold",
        status: "ARCHIVED",
        sortOrder: 3,
        createdAt: new Date("2026-05-20T10:30:00.000Z"),
        updatedAt: new Date("2026-05-20T11:30:00.000Z"),
        variants: [
          {
            id: "variant-cap-one",
            label: "One Size",
            sku: "CAP-ONE",
            unitAmount: 2200,
            currency: "USD",
            inventoryQuantity: 0,
            isActive: false,
            sortOrder: 1,
            createdAt: new Date("2026-05-20T10:30:00.000Z"),
            updatedAt: new Date("2026-05-20T11:30:00.000Z"),
          },
        ],
      },
    ]);
    getChairMarketplaceOverview.mockResolvedValue({
      counts: {
        review: 0,
        unfulfilled: 0,
        ready: 0,
        fulfilled: 0,
      },
      reviewQueue: [],
      activeOrders: [],
      recentFulfilledOrders: [],
    });

    const html = renderToStaticMarkup(
      await ChairMarketplacePage({
        searchParams: Promise.resolve({ tab: "catalog" }),
      }),
    );

    expect(html).toContain("Retired Cap");
    expect(html).toContain("Restore to draft");
    expect(html).toContain("Delete permanently");
    expect(html).toContain("Reference only");
    expect(html).not.toContain("Save listing");
    expect(html).not.toContain("Save variant");
    expect(html).not.toContain("Add variant");
  });
});
