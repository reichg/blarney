import { ModularCard } from "@/components/ModularCard";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/ModularCard.module.css", () => ({
  default: {
    card: "card",
  },
}));

describe("ModularCard", () => {
  it("renders the requested element and keeps child content", () => {
    const html = renderToStaticMarkup(
      ModularCard({
        as: "section",
        children: createElement("h2", null, "Card title"),
        className: "custom-card",
      }),
    );

    expect(html).toContain("<section");
    expect(html).toContain('class="card custom-card"');
    expect(html).toContain("Card title");
  });
});
