import { FilterableCardGrid } from "@/app/chair/FilterableCardGrid";
import { createElement } from "react";
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

vi.mock("next/navigation", () => ({
  usePathname: () => "/chair/registrations",
  useRouter: () => ({
    replace: vi.fn(),
  }),
}));

describe("FilterableCardGrid", () => {
  it("renders the server pagination summary when pagination state is provided", () => {
    const html = renderToStaticMarkup(
      createElement(
        FilterableCardGrid,
        {
          emptyMessage:
            "No registrations match this search on the current page.",
          items: [
            {
              id: "registration-51",
              searchText: "Ada Lovelace ada@example.com",
            },
          ],
          pagination: {
            currentCount: 1,
            endIndex: 51,
            hasNextPage: false,
            hasPreviousPage: true,
            isEmpty: false,
            page: 2,
            pageKey: "page",
            pageSize: 50,
            pageSizeKey: "pageSize",
            skip: 50,
            startIndex: 51,
            take: 50,
            totalCount: 51,
            totalPages: 2,
          },
          resultLabel: "registrations",
          searchLabel: "Search registrations",
          searchPlaceholder: "Search names, emails, packages, notes",
        },
        createElement("article", null, "Ada Lovelace"),
      ),
    );

    expect(html).toContain("Showing 51-51 of 51");
    expect(html).not.toContain("Showing 1 of 1 registrations on this page");
  });

  it("falls back to the local count summary when no pagination is provided", () => {
    const html = renderToStaticMarkup(
      createElement(
        FilterableCardGrid,
        {
          emptyMessage: "No golfers match this search.",
          items: [
            {
              id: "golfer-1",
              searchText: "Ada Lovelace",
            },
            {
              id: "golfer-2",
              searchText: "Grace Hopper",
            },
          ],
          resultLabel: "golfers",
          searchLabel: "Search golfers",
          searchPlaceholder: "Search names",
        },
        createElement("article", null, "Ada Lovelace"),
        createElement("article", null, "Grace Hopper"),
      ),
    );

    expect(html).toContain("Showing 2 of 2 golfers");
    expect(html).not.toContain("Showing 2 of 2 golfers on this page");
  });
});
