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
    expect(html).toContain("Email");
    expect(html).toContain("Name");
    expect(html).toContain("Phone");
    expect(html).toContain("Continue to secure checkout");
    expect(html).toContain('class="quantityInput"');
    expect(html).toContain('class="buyerFields"');
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

  it("removes native number spinners and uses marketplace-local buyer field layout", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/app/marketplace/marketplace.module.css"),
      "utf8",
    );

    expect(css).toMatch(/\.quantityInput\s*\{[\s\S]*?appearance:\s*textfield;/);
    expect(css).toMatch(
      /\.quantityInput::-webkit-inner-spin-button,\s*\.quantityInput::-webkit-outer-spin-button\s*\{[\s\S]*?-webkit-appearance:\s*none;/,
    );
    expect(css).toMatch(/\.checkoutPanel\s*\{[\s\S]*?display:\s*grid;/);
    expect(css).toMatch(/\.buyerFields\s*\{[\s\S]*?display:\s*grid;/);
  });

  it("keeps listing cards on a shared desktop height contract", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/app/marketplace/marketplace.module.css"),
      "utf8",
    );

    expect(css).toMatch(
      /\.listingCard\s*\{[\s\S]*?min-height:\s*clamp\(19rem, 22vw, 24rem\);/,
    );
    expect(css).toMatch(
      /\.listingBody\s*\{[\s\S]*?grid-template-rows:\s*auto minmax\(0, 1fr\);/,
    );
    expect(css).toMatch(/\.listingBody\s*\{[\s\S]*?justify-content:\s*center;/);
    expect(css).toMatch(/\.listingCopy\s*\{[\s\S]*?justify-content:\s*center;/);
    expect(css).toMatch(/\.variantRow\s*\{[\s\S]*?min-width:\s*0;/);
    expect(css).toMatch(/\.variantMeta\s*\{[\s\S]*?min-width:\s*0;/);
    expect(css).toMatch(/\.variantList\s*\{[\s\S]*?align-self:\s*end;/);
  });

  it("defines responsive catalog and checkout breakpoints for the marketplace layout", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/app/marketplace/marketplace.module.css"),
      "utf8",
    );

    expect(css).toMatch(
      /@media \(min-width: 900px\)\s*\{[\s\S]*?\.storefront\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) clamp\(19rem, 26vw, 24rem\);/,
    );
    expect(css).toMatch(
      /@media \(min-width: 1120px\)\s*\{[\s\S]*?\.checkoutColumn\s*\{[\s\S]*?position:\s*sticky;[\s\S]*?top:\s*6rem;/,
    );
    expect(css).toMatch(
      /@media \(max-width: 1100px\)\s*\{[\s\S]*?\.listingCard\s*\{[\s\S]*?grid-template-columns:\s*minmax\(11rem, 15rem\) minmax\(0, 1fr\);/,
    );
    expect(css).toMatch(
      /@media \(max-width: 1100px\)\s*\{[\s\S]*?\.variantRow\s*\{[\s\S]*?grid-template-columns:\s*1fr;/,
    );
    expect(css).toMatch(
      /@media \(max-width: 1100px\)\s*\{[\s\S]*?\.quantityControl\s*\{[\s\S]*?width:\s*min\(100%, 9\.65rem\);/,
    );
    expect(css).toMatch(
      /@media \(max-width: 900px\)\s*\{[\s\S]*?\.infoPanels,\s*\.storefront\s*\{[\s\S]*?grid-template-columns:\s*1fr;/,
    );
    expect(css).toMatch(
      /@media \(max-width: 900px\)\s*\{[\s\S]*?\.variantRow\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) minmax\(8\.75rem, auto\);[\s\S]*?width:\s*min\(100%, 28rem\);/,
    );
    expect(css).toMatch(
      /@media \(max-width: 900px\)\s*\{[\s\S]*?\.quantityControl\s*\{[\s\S]*?justify-self:\s*end;/,
    );
    expect(css).not.toMatch(
      /@media \(max-width: 720px\)\s*\{[\s\S]*?\.variantRow\s*\{[\s\S]*?grid-template-columns:\s*1fr;/,
    );
    expect(css).toMatch(
      /@media \(max-width: 720px\)\s*\{[\s\S]*?\.listingCard\s*\{[\s\S]*?min-height:\s*0;/,
    );
  });
});
