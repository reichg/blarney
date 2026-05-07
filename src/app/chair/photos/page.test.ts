import ChairPhotosPage from "@/app/chair/photos/page";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

type FilterableCardGridProps = {
  children: React.ReactNode;
  resultLabel: string;
  urlBackedFilter?: {
    value: string;
    searchParams: Record<string, string | string[] | undefined>;
    filterParamKey?: string;
    pageParamKey?: string;
  };
};

type PaginationNavProps = {
  label?: string;
  searchParams?: Record<string, string | string[] | undefined>;
};

const {
  filterableCardGrid,
  listPendingChairGalleryPhotosPage,
  listReviewedChairGalleryPhotosPage,
  paginationNav,
  requireChairPageAuth,
} = vi.hoisted(() => ({
  filterableCardGrid: vi.fn(({ children }) =>
    createElement("section", null, children),
  ),
  listPendingChairGalleryPhotosPage: vi.fn(),
  listReviewedChairGalleryPhotosPage: vi.fn(),
  paginationNav: vi.fn(() => createElement("nav", null, "pagination")),
  requireChairPageAuth: vi.fn(async () => {}),
}));

vi.mock("@/app/actions/chairPhotos", () => ({
  approvePhoto: async () => {},
  rejectPhoto: async () => {},
  returnApprovedPhotoToPending: async () => {},
}));

vi.mock("@/app/chair/chair.module.css", () => ({
  default: new Proxy(
    {},
    {
      get: (_, key) => String(key),
    },
  ),
}));

vi.mock("@/app/chair/display", () => ({
  displayValue: (value: string | null | undefined) => value ?? "N/A",
  joinSearchText: (parts: Array<string | number | null | undefined>) =>
    parts
      .filter(
        (part) =>
          part !== null && part !== undefined && `${part}`.trim().length,
      )
      .join(" "),
}));

vi.mock("@/app/chair/FilterableCardGrid", () => ({
  FilterableCardGrid: (props: FilterableCardGridProps) => {
    filterableCardGrid(props);
    return createElement("section", null, props.children);
  },
}));

vi.mock("@/app/chair/PreviewDetailCard", () => ({
  PreviewDetailCard: ({ children }: { children: React.ReactNode }) =>
    createElement("article", null, children),
}));

vi.mock("@/components/PaginationNav", () => ({
  PaginationNav: (props: PaginationNavProps) => {
    paginationNav(props);
    return createElement("nav", null, props.label ?? "Results");
  },
}));

vi.mock("@/lib/chairAuth.server", () => ({
  requireChairPageAuth,
}));

vi.mock("@/lib/chairPhotos", () => ({
  listPendingChairGalleryPhotosPage,
  listReviewedChairGalleryPhotosPage,
}));

vi.mock("@/lib/format", () => ({
  formatDateTime: (value: Date) => value.toISOString(),
}));

describe("chair photos page", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("keeps the pending and reviewed filtered pagination independent", async () => {
    listPendingChairGalleryPhotosPage.mockResolvedValue({
      pagination: {
        currentCount: 1,
        endIndex: 1,
        hasNextPage: false,
        hasPreviousPage: true,
        isEmpty: false,
        page: 2,
        pageKey: "pendingPage",
        pageSize: 50,
        pageSizeKey: "pendingPageSize",
        skip: 50,
        startIndex: 1,
        take: 50,
        totalCount: 1,
        totalPages: 1,
      },
      photos: [
        {
          approvedAt: null,
          caption: "Bagpiper",
          createdAt: new Date("2026-05-01T12:00:00.000Z"),
          feedback: null,
          id: "pending-1",
          reviewNotes: null,
          submitterEmail: "ada@example.com",
          submitterName: "Ada",
        },
      ],
    });
    listReviewedChairGalleryPhotosPage.mockResolvedValue({
      pagination: {
        currentCount: 1,
        endIndex: 1,
        hasNextPage: false,
        hasPreviousPage: true,
        isEmpty: false,
        page: 3,
        pageKey: "reviewedPage",
        pageSize: 50,
        pageSizeKey: "reviewedPageSize",
        skip: 100,
        startIndex: 1,
        take: 50,
        totalCount: 1,
        totalPages: 1,
      },
      photos: [
        {
          approvedAt: new Date("2026-05-01T15:00:00.000Z"),
          caption: "Final green",
          createdAt: new Date("2026-05-01T12:00:00.000Z"),
          feedback: null,
          id: "reviewed-1",
          reviewNotes: "Looks good",
          submitterEmail: "grace@example.com",
          submitterName: "Grace",
        },
      ],
    });

    renderToStaticMarkup(
      await ChairPhotosPage({
        searchParams: Promise.resolve({
          pendingFilter: "caption:yes",
          pendingPage: "2",
          reviewedFilter: "notes:no",
          reviewedPage: "3",
        }),
      }),
    );

    expect(requireChairPageAuth).toHaveBeenCalledWith("/chair/photos");
    expect(listPendingChairGalleryPhotosPage).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        pageKey: "pendingPage",
      }),
      {
        AND: [{ caption: { not: null } }, { NOT: { caption: "" } }],
      },
    );
    expect(listReviewedChairGalleryPhotosPage).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 3,
        pageKey: "reviewedPage",
      }),
      {
        OR: [{ reviewNotes: null }, { reviewNotes: "" }],
      },
    );

    const pendingGridProps = filterableCardGrid.mock.calls.find(
      ([props]) => props.resultLabel === "pending uploads",
    )?.[0] as FilterableCardGridProps | undefined;
    const reviewedGridProps = filterableCardGrid.mock.calls.find(
      ([props]) => props.resultLabel === "approved photos",
    )?.[0] as FilterableCardGridProps | undefined;

    expect(pendingGridProps?.urlBackedFilter).toEqual({
      value: "caption:yes",
      searchParams: {
        pendingFilter: "caption:yes",
        pendingPage: "2",
        reviewedFilter: "notes:no",
        reviewedPage: "3",
      },
      filterParamKey: "pendingFilter",
      pageParamKey: "pendingPage",
    });
    expect(reviewedGridProps?.urlBackedFilter).toEqual({
      value: "notes:no",
      searchParams: {
        pendingFilter: "caption:yes",
        pendingPage: "2",
        reviewedFilter: "notes:no",
        reviewedPage: "3",
      },
      filterParamKey: "reviewedFilter",
      pageParamKey: "reviewedPage",
    });

    expect(paginationNav).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "Pending uploads",
        searchParams: {
          pendingFilter: "caption:yes",
          pendingPage: "2",
          reviewedFilter: "notes:no",
          reviewedPage: "3",
        },
      }),
    );
    expect(paginationNav).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "Approved photos",
        searchParams: {
          pendingFilter: "caption:yes",
          pendingPage: "2",
          reviewedFilter: "notes:no",
          reviewedPage: "3",
        },
      }),
    );
  });
});
