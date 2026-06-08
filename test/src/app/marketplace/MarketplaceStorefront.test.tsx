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

  it("renders a single accessible variant dropdown that exposes every variant", () => {
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
              {
                id: "variant-hoodie-l",
                label: "Large",
                sku: "HOODIE-L",
                unitAmount: 4800,
                currency: "USD",
                inventoryQuantity: 5,
              },
            ],
          },
        ],
      }),
    );

    // A single native <select> replaces the old per-variant rows.
    expect(html).toContain('class="variantPicker"');
    expect(html).toContain('class="variantSelect"');
    expect(html).toContain('id="marketplace-variant-listing-hoodie"');
    expect(html).not.toContain("variantRow");
    expect(html).not.toContain("variantList");
    expect(html).not.toContain("variantMeta");

    // Every variant remains selectable from the one dropdown, so the cart model
    // can still hold multiple variants per listing.
    expect(html).toContain('value="variant-hoodie-m"');
    expect(html).toContain('value="variant-hoodie-l"');
    expect(html).toContain("Medium");
    expect(html).toContain("Large");
    expect(html).toContain("$45.00");
    expect(html).toContain("$48.00");

    // One shared quantity stepper services the selected variant.
    const quantityInputs = html.match(/class="quantityInput"/g) ?? [];
    expect(quantityInputs).toHaveLength(1);
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

  it("keeps every variant-picker section uniform via reserved, line-clamped regions", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/app/marketplace/marketplace.module.css"),
      "utf8",
    );

    // Card height is content-driven, NOT a magic number: every interior region
    // is reserved at a constant size, so the natural height is already identical
    // across cards. The card declares its grid but no explicit `height` and no
    // `--title-size` custom property — those fragile magic-number contracts were
    // reverted.
    expect(css).toMatch(
      /\.listingCard\s*\{[\s\S]*?grid-template-columns:\s*minmax\(12rem, 19rem\) minmax\(0, 1fr\);/,
    );
    expect(css).toMatch(/\.listingCard\s*\{[\s\S]*?box-shadow:\s*none;/);
    // The removed `--title-size` custom property must be gone entirely.
    expect(css).not.toMatch(/--title-size/);
    // The base card no longer declares any `height` (content-driven), so neither
    // the explicit magic-number height nor a min-height floor should appear in
    // the base rule.
    expect(css).not.toMatch(
      /\.listingCard\s*\{[^}]*?(?<!min-)height:/,
    );
    expect(css).not.toMatch(/\.listingCard\s*\{[^}]*?min-height:/);

    // The body is now two fixed-size rows (reserved copy region + picker) in a
    // single column, content-aligned to start (the picker, title, and
    // description are all reserved/clamped, so start-aligning keeps every card
    // identical); the old flexible rows and `justify-content: center` are gone.
    expect(css).toMatch(/\.listingBody\s*\{[\s\S]*?grid-template-rows:\s*auto auto;/);
    expect(css).toMatch(
      /\.listingBody\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\);/,
    );
    expect(css).toMatch(/\.listingBody\s*\{[\s\S]*?align-content:\s*start;/);
    expect(css).not.toMatch(/\.listingBody\s*\{[^}]*?align-content:\s*center;/);
    expect(css).not.toMatch(/\.listingBody\s*\{[^}]*?justify-content:\s*center;/);

    // The copy region reserves a constant block (two auto rows, start-aligned)
    // instead of centering, so the picker below always starts at the same offset.
    expect(css).toMatch(/\.listingCopy\s*\{[\s\S]*?grid-template-rows:\s*auto auto;/);
    expect(css).toMatch(/\.listingCopy\s*\{[\s\S]*?align-content:\s*start;/);
    expect(css).toMatch(/\.listingCopy\s*\{[\s\S]*?min-width:\s*0;/);
    expect(css).not.toMatch(/\.listingCopy\s*\{[^}]*?justify-content:\s*center;/);

    // The title is line-clamped to two lines (visual-only truncation) at a fluid
    // font size with word-breaking, reserving a constant two-line min-height.
    // The fluid size is the literal clamp again (the `--title-size` custom
    // property indirection was reverted along with the explicit card height).
    expect(css).toMatch(
      /\.listingCopy h3\s*\{[\s\S]*?font-size:\s*clamp\(1\.5rem, 1\.05rem \+ 1\.6vw, 2\.5rem\);/,
    );
    expect(css).toMatch(
      /\.listingCopy h3\s*\{[\s\S]*?overflow-wrap:\s*anywhere;/,
    );
    expect(css).toMatch(
      /\.listingCopy h3\s*\{[\s\S]*?-webkit-line-clamp:\s*2;/,
    );
    expect(css).toMatch(
      /\.listingCopy h3\s*\{[\s\S]*?min-height:\s*calc\(1\.15em \* 2\);/,
    );

    // The description is line-clamped to three lines and reserves a constant
    // three-line block.
    expect(css).toMatch(/\.listingCopy p\s*\{[\s\S]*?-webkit-line-clamp:\s*3;/);
    expect(css).toMatch(
      /\.listingCopy p\s*\{[\s\S]*?min-height:\s*calc\(1\.6em \* 3\);/,
    );

    // The single-dropdown picker replaced the removed per-variant row classes.
    expect(css).toMatch(/\.variantPicker\s*\{[\s\S]*?min-width:\s*0;/);
    expect(css).toMatch(/\.variantPicker\s*\{[\s\S]*?align-self:\s*end;/);
    // The picker is permanently single-column (the select, help, and quantity
    // each get the full picker width on their own row) so the longest
    // "label — price" string is never truncated, with three fixed rows that are
    // start-aligned so identical content lays out identically.
    expect(css).toMatch(
      /\.variantPicker\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\);/,
    );
    expect(css).toMatch(
      /\.variantPicker\s*\{[\s\S]*?grid-template-rows:\s*auto auto auto;/,
    );
    expect(css).toMatch(/\.variantPicker\s*\{[\s\S]*?align-content:\s*start;/);
    // Uniform picker size across cards now comes from a FIXED picker `height`
    // (not a min-height floor) plus a line-clamped, reserved two-line help text,
    // so every picker box is pixel-identical regardless of help wrapping.
    expect(css).toMatch(
      /\.variantPicker\s*\{[\s\S]*?(?<!min-)height:\s*13\.5rem;/,
    );
    expect(css).not.toMatch(/\.variantPicker\s*\{[\s\S]*?min-height:\s*13\.5rem;/);
    expect(css).toMatch(/\.variantHelp\s*\{[\s\S]*?-webkit-line-clamp:\s*2;/);
    expect(css).toMatch(/\.variantHelp\s*\{[\s\S]*?min-height:\s*2\.64rem;/);
    expect(css).toMatch(/\.variantSelectField\s*\{[\s\S]*?min-width:\s*0;/);
    expect(css).toMatch(/\.variantSelect\s*\{[\s\S]*?width:\s*100%;/);
    // The obsolete per-variant layout classes must be gone entirely.
    expect(css).not.toMatch(/\.variantRow\b/);
    expect(css).not.toMatch(/\.variantList\b/);
    expect(css).not.toMatch(/\.variantMeta\b/);
  });

  it("defines responsive catalog and checkout breakpoints for the marketplace layout", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/app/marketplace/marketplace.module.css"),
      "utf8",
    );

    expect(css).toMatch(
      /@media \(min-width: 900px\)\s*\{[\s\S]*?\.storefront\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) clamp\(19rem, 26vw, 24rem\);/,
    );
    // The sticky checkout column and the scrollable catalog now both activate
    // at the same 900px two-column breakpoint (moved up from 1120px) so there
    // is never a viewport where one scrolls but the other does not.
    expect(css).toMatch(
      /@media \(min-width: 900px\)\s*\{[\s\S]*?\.checkoutColumn\s*\{[\s\S]*?position:\s*sticky;[\s\S]*?top:\s*6rem;/,
    );
    expect(css).toMatch(
      /@media \(min-width: 900px\)\s*\{[\s\S]*?\.catalogGrid\s*\{[\s\S]*?max-height:\s*calc\(100vh - 7\.5rem\);[\s\S]*?overflow-y:\s*auto;/,
    );
    // The 1120px breakpoint block was removed entirely.
    expect(css).not.toMatch(/@media \(min-width: 1120px\)/);
    expect(css).toMatch(
      /@media \(max-width: 1100px\)\s*\{[\s\S]*?\.listingCard\s*\{[\s\S]*?grid-template-columns:\s*minmax\(11rem, 15rem\) minmax\(0, 1fr\);/,
    );
    // The `@media (max-width: 1100px)` block now ONLY restyles the listing card
    // grid; it no longer touches the picker. Scope the assertion to that block's
    // own braces so it cannot leak into a later `.variantPicker` rule.
    const maxWidth1100Block =
      css.match(
        /@media \(max-width: 1100px\)\s*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/,
      )?.[0] ?? "";
    expect(maxWidth1100Block).toContain(".listingCard");
    expect(maxWidth1100Block).not.toContain(".variantPicker");

    // 900–1099px is the narrow two-column range: the card stays HORIZONTAL (it is
    // NOT stacked here anymore). To avoid cramping, the media column shrinks and
    // the body padding is trimmed while keeping a side-by-side media/body layout.
    // Two nested rules (.listingCard, .listingBody), then the media block closes.
    const narrowHorizontalBlock =
      css.match(
        /@media \(min-width: 900px\) and \(max-width: 1099px\)\s*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/,
      )?.[0] ?? "";
    expect(narrowHorizontalBlock).toMatch(
      /\.listingCard\s*\{[\s\S]*?grid-template-columns:\s*minmax\(9rem, 12rem\) minmax\(0, 1fr\);/,
    );
    expect(narrowHorizontalBlock).toMatch(
      /\.listingBody\s*\{[\s\S]*?padding:\s*1\.1rem;/,
    );
    // It is horizontal, so it must NOT collapse the card to a single column and
    // must NOT introduce a stacked media band here.
    expect(narrowHorizontalBlock).not.toMatch(
      /\.listingCard\s*\{[^}]*?grid-template-columns:\s*1fr;/,
    );
    expect(narrowHorizontalBlock).not.toContain(".listingMedia");

    expect(css).toMatch(
      /@media \(max-width: 900px\)\s*\{[\s\S]*?\.infoPanels,\s*\.storefront\s*\{[\s\S]*?grid-template-columns:\s*1fr;/,
    );

    // On phones (<=720px) the card stacks media over body and stays content-driven
    // (no explicit `height`, no `min-height: 0` on the card). The stacked media is
    // a TALLER fixed band with an explicit `height` plus `min-height: 0`.
    const maxWidth720Block =
      css.match(/@media \(max-width: 720px\)\s*\{[\s\S]*\}/)?.[0] ?? "";
    expect(maxWidth720Block).toMatch(
      /\.listingCard\s*\{[\s\S]*?grid-template-columns:\s*1fr;/,
    );
    expect(maxWidth720Block).toMatch(
      /\.listingMedia\s*\{[\s\S]*?height:\s*clamp\(15rem, 62vw, 21rem\);[\s\S]*?min-height:\s*0;/,
    );
    // The stacked card no longer declares its own `height` or `min-height`.
    expect(css).not.toMatch(
      /@media \(max-width: 720px\)\s*\{[\s\S]*?\.listingCard\s*\{[^}]*?(?<!min-)height:/,
    );
    expect(css).not.toMatch(
      /@media \(max-width: 720px\)\s*\{[\s\S]*?\.listingCard\s*\{[^}]*?min-height:/,
    );

    // <=720px picker becomes a ONE-ROW layout: the select field shares row 1 with
    // the quantity control (two columns) and the help text spans both columns on
    // row 2. `height: auto` overrides the base horizontal-layout fixed 13.5rem.
    expect(maxWidth720Block).toMatch(
      /\.variantPicker\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) auto;/,
    );
    expect(maxWidth720Block).toMatch(
      /\.variantPicker\s*\{[\s\S]*?grid-template-rows:\s*auto auto;/,
    );
    expect(maxWidth720Block).toMatch(
      /\.variantPicker\s*\{[\s\S]*?align-items:\s*end;/,
    );
    expect(maxWidth720Block).toMatch(
      /\.variantPicker\s*\{[\s\S]*?height:\s*auto;/,
    );
    // Picker child placements for the one-row layout.
    expect(maxWidth720Block).toMatch(
      /\.variantSelectField\s*\{[\s\S]*?grid-column:\s*1;[\s\S]*?grid-row:\s*1;/,
    );
    expect(maxWidth720Block).toMatch(
      /\.quantityControl\s*\{[\s\S]*?grid-column:\s*2;[\s\S]*?grid-row:\s*1;[\s\S]*?justify-self:\s*end;[\s\S]*?width:\s*auto;/,
    );
    expect(maxWidth720Block).toMatch(
      /\.variantHelp\s*\{[\s\S]*?grid-column:\s*1 \/ -1;[\s\S]*?grid-row:\s*2;/,
    );
  });
});
