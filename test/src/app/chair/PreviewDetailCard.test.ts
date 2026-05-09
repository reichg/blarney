import { PreviewDetailCard } from "@/app/chair/PreviewDetailCard";
import { createElement, type ComponentType, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/chair/chair.module.css", () => ({
  default: new Proxy(
    {},
    {
      get: (_, key) => String(key),
    },
  ),
}));

type PreviewDetailCardRenderProps = {
  title: string;
  openLabel: string;
  preview: ReactNode;
  header?: ReactNode;
  children?: ReactNode;
};

describe("PreviewDetailCard", () => {
  it("renders the optional header alongside preview content", () => {
    const PreviewDetailCardComponent =
      PreviewDetailCard as ComponentType<PreviewDetailCardRenderProps>;

    const html = renderToStaticMarkup(
      createElement(
        PreviewDetailCardComponent,
        {
          header: createElement("div", null, "Header slot"),
          openLabel: "Open sample details",
          preview: createElement("p", null, "Preview content"),
          title: "Sample item",
        },
        createElement("p", null, "Detail content"),
      ),
    );

    expect(html).toContain("Header slot");
    expect(html).toContain("Preview content");
    expect(html).toContain("Open sample details");
  });
});
