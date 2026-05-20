import MarketplacePage from "@/app/marketplace/page";
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

vi.mock("@/lib/marketplaceCatalog", () => ({
  getMarketplaceCatalog: vi.fn(async () => [
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
  ]),
}));

describe("MarketplacePage", () => {
  it("renders the marketplace details landmark ahead of the storefront", async () => {
    const page = await MarketplacePage();
    const html = renderToStaticMarkup(page);

    expect(html).toContain("Marketplace details and checkout notes");
    expect(html).toContain("One clean merch flow");
    expect(html).toContain("Build a simple merch order");
    expect(html.indexOf("One clean merch flow")).toBeLessThan(
      html.indexOf("Build a simple merch order"),
    );
    expect(html).toContain("Blarney Hoodie");
  });
});
