import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  buildPaginationState,
  parsePaginationParams,
} from "@/lib/pagination";
import { describe, expect, it } from "vitest";

describe("parsePaginationParams", () => {
  it("uses the default first page and page size", () => {
    expect(parsePaginationParams(undefined)).toEqual({
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      skip: 0,
      take: DEFAULT_PAGE_SIZE,
      pageKey: "page",
      pageSizeKey: "pageSize",
    });
  });

  it("uses the first search param value and clamps page size to the max", () => {
    expect(
      parsePaginationParams({
        page: ["3", "7"],
        pageSize: "500",
      }),
    ).toEqual({
      page: 3,
      pageSize: MAX_PAGE_SIZE,
      skip: 100,
      take: MAX_PAGE_SIZE,
      pageKey: "page",
      pageSizeKey: "pageSize",
    });
  });

  it("falls back to defaults for invalid values and honors custom keys", () => {
    expect(
      parsePaginationParams(
        {
          pendingPage: "0",
          pendingPageSize: "15",
        },
        {
          pageKey: "pendingPage",
          pageSizeKey: "pendingPageSize",
        },
      ),
    ).toEqual({
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      skip: 0,
      take: DEFAULT_PAGE_SIZE,
      pageKey: "pendingPage",
      pageSizeKey: "pendingPageSize",
    });
  });

  it("accepts the allowlisted page-size options", () => {
    expect(
      PAGE_SIZE_OPTIONS.map(
        (pageSize) => parsePaginationParams({ pageSize: `${pageSize}` }).pageSize,
      ),
    ).toEqual([...PAGE_SIZE_OPTIONS]);
  });
});

describe("buildPaginationState", () => {
  it("builds page metadata for a populated result set", () => {
    const params = parsePaginationParams({ page: "2", pageSize: "20" });

    expect(buildPaginationState(params, 60)).toEqual({
      ...params,
      totalCount: 60,
      totalPages: 3,
      currentCount: 20,
      startIndex: 21,
      endIndex: 40,
      hasPreviousPage: true,
      hasNextPage: true,
      isEmpty: false,
    });
  });

  it("handles empty and out-of-range pages without negative ranges", () => {
    const params = parsePaginationParams({ page: "4", pageSize: "20" });

    expect(buildPaginationState(params, 60)).toEqual({
      ...params,
      totalCount: 60,
      totalPages: 3,
      currentCount: 0,
      startIndex: 0,
      endIndex: 0,
      hasPreviousPage: true,
      hasNextPage: false,
      isEmpty: false,
    });

    expect(buildPaginationState(parsePaginationParams(undefined), 0)).toEqual({
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      skip: 0,
      take: DEFAULT_PAGE_SIZE,
      pageKey: "page",
      pageSizeKey: "pageSize",
      totalCount: 0,
      totalPages: 1,
      currentCount: 0,
      startIndex: 0,
      endIndex: 0,
      hasPreviousPage: false,
      hasNextPage: false,
      isEmpty: true,
    });
  });
});
