import { MarketplaceStorefront } from "@/app/marketplace/MarketplaceStorefront";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/forms.module.css", () => ({
  default: new Proxy(
    {},
    {
      get: (_, key) => String(key),
    },
  ),
}));

vi.mock("@/app/marketplace/marketplace.module.css", () => ({
  default: new Proxy(
    {},
    {
      get: (_, key) => String(key),
    },
  ),
}));

vi.mock("@/components/ModularCard.module.css", () => ({
  default: new Proxy(
    {},
    {
      get: (_, key) => String(key),
    },
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe("MarketplaceStorefront", () => {
  it("keeps the checkout button out of the loading state on initial render", () => {
    const html = renderToStaticMarkup(
      createElement(MarketplaceStorefront, {
        listings: [
          {
            id: "listing-hoodie",
            slug: "hoodie",
            title: "Blarney Hoodie",
            description: "Heavyweight fleece for the tournament weekend.",
            imageUrl: "/images/hoodie.jpg",
            fulfillmentNote: "Pickup at check-in.",
            sortOrder: 0,
            variants: [
              {
                id: "variant-hoodie-m",
                label: "Medium",
                sku: "HOODIE-M",
                unitAmount: 4500,
                currency: "USD",
                inventoryQuantity: 8,
              },
            ],
          },
        ],
      }),
    );

    expect(html).not.toContain('aria-busy="true"');
    expect(html).not.toContain('data-loading="true"');
  });

  it("renders listings, variants, and the checkout call to action", () => {
    const html = renderToStaticMarkup(
      createElement(MarketplaceStorefront, {
        listings: [
          {
            id: "listing-hoodie",
            slug: "hoodie",
            title: "Blarney Hoodie",
            description: "Heavyweight fleece for the tournament weekend.",
            imageUrl: "/images/hoodie.jpg",
            fulfillmentNote: "Pickup at check-in.",
            sortOrder: 0,
            variants: [
              {
                id: "variant-hoodie-m",
                label: "Medium",
                sku: "HOODIE-M",
                unitAmount: 4500,
                currency: "USD",
                inventoryQuantity: 8,
              },
            ],
          },
        ],
      }),
    );

    expect(html).toContain("Blarney Hoodie");
    expect(html).toContain("Heavyweight fleece for the tournament weekend.");
    expect(html).toContain("Medium");
    expect(html).toContain("$45.00");
    expect(html).toContain("Buyer details");
    expect(html).toContain("Continue to secure checkout");
  });

  it("uses a submitting-only wait cursor contract for the marketplace CTA", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/app/marketplace/marketplace.module.css"),
      "utf8",
    );

    expect(css).toMatch(
      /\.checkoutButton:disabled\s*\{[\s\S]*?cursor:\s*not-allowed;/,
    );
    expect(css).toMatch(
      /\.checkoutButton\[data-loading="true"\]:disabled\s*\{[\s\S]*?cursor:\s*wait;/,
    );
  });
});
