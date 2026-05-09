import { PaginationNav } from "@/components/PaginationNav";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/PaginationNav.module.css", () => ({
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
    children: ReactNode;
    href: string;
  }) => createElement("a", { href, ...props }, children),
}));

describe("PaginationNav", () => {
  it("renders the fixed page-size options", () => {
    const html = renderToStaticMarkup(
      createElement(PaginationNav, {
        label: "Registrations",
        pagination: {
          currentCount: 10,
          endIndex: 20,
          hasNextPage: true,
          hasPreviousPage: true,
          isEmpty: false,
          page: 2,
          pageKey: "page",
          pageSize: 20,
          pageSizeKey: "pageSize",
          skip: 20,
          startIndex: 11,
          take: 20,
          totalCount: 32,
          totalPages: 2,
        },
        searchParams: {
          filter: "complete",
          page: "2",
          pageSize: "20",
        },
      }),
    );

    expect(html).toContain('name="pageSize"');
    expect(html).toContain('value="10"');
    expect(html).toContain('value="20"');
    expect(html).toContain('value="30"');
    expect(html).toContain('value="40"');
    expect(html).toContain('value="50"');
    expect(html).toContain("Apply");
  });

  it("does not duplicate the active page-size key in the GET form", () => {
    const html = renderToStaticMarkup(
      createElement(PaginationNav, {
        label: "Registrations",
        pagination: {
          currentCount: 20,
          endIndex: 40,
          hasNextPage: true,
          hasPreviousPage: true,
          isEmpty: false,
          page: 2,
          pageKey: "page",
          pageSize: 20,
          pageSizeKey: "pageSize",
          skip: 20,
          startIndex: 21,
          take: 20,
          totalCount: 60,
          totalPages: 3,
        },
        searchParams: {
          filter: "complete",
          page: "2",
          pageSize: "20",
        },
      }),
    );

    expect(html).not.toMatch(/type="hidden"[^>]*name="pageSize"/);
    expect(html).toContain('name="pageSize"');
    expect(html).toContain(
      'href="?filter=complete&amp;page=1&amp;pageSize=20"',
    );
  });

  it("preserves unrelated params and resets only the active page key in the page-size form", () => {
    const html = renderToStaticMarkup(
      createElement(PaginationNav, {
        label: "Draft groups",
        pagination: {
          currentCount: 1,
          endIndex: 11,
          hasNextPage: false,
          hasPreviousPage: true,
          isEmpty: false,
          page: 2,
          pageKey: "draftPage",
          pageSize: 10,
          pageSizeKey: "draftPageSize",
          skip: 10,
          startIndex: 11,
          take: 10,
          totalCount: 11,
          totalPages: 2,
        },
        searchParams: {
          draftFilter: "capacity:open",
          draftPage: "2",
          draftPageSize: "10",
          publishedPage: "3",
          publishedPageSize: "40",
          unassignedPage: "4",
          unassignedPageSize: "20",
        },
      }),
    );

    expect(html).toMatch(/type="hidden"[^>]*name="draftPage"[^>]*value="1"/);
    expect(html).not.toMatch(/type="hidden"[^>]*name="draftPageSize"/);
    expect(html).toMatch(
      /type="hidden"[^>]*name="publishedPage"[^>]*value="3"/,
    );
    expect(html).toMatch(
      /type="hidden"[^>]*name="publishedPageSize"[^>]*value="40"/,
    );
    expect(html).toMatch(
      /type="hidden"[^>]*name="unassignedPage"[^>]*value="4"/,
    );
    expect(html).toMatch(
      /type="hidden"[^>]*name="unassignedPageSize"[^>]*value="20"/,
    );
    expect(html).toContain(
      'href="?draftFilter=capacity%3Aopen&amp;draftPage=1&amp;draftPageSize=10&amp;publishedPage=3&amp;publishedPageSize=40&amp;unassignedPage=4&amp;unassignedPageSize=20"',
    );
  });
});
