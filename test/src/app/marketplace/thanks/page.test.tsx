import MarketplaceThanksPage from "@/app/marketplace/thanks/page";
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

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => createElement("a", { href, ...props }, children),
}));

describe("MarketplaceThanksPage", () => {
  it("renders the confirmed order reference when one is present", async () => {
    const page = await MarketplaceThanksPage({
      searchParams: Promise.resolve({ order: "order-123" }),
    });
    const html = renderToStaticMarkup(page);

    expect(html).toContain("Order confirmed.");
    expect(html).toContain("Order reference: order-123");
    expect(html).toContain("Back to marketplace");
  });
});
