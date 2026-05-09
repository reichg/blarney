import type {
  PageSizeOption,
  PaginationKeyOptions,
  PaginationParams,
  PaginationState,
  SearchParamsRecord,
} from "@/lib/type";
import { z } from "zod";

export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 50;
export const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, MAX_PAGE_SIZE] as const;

export type {
  PaginationKeyOptions,
  PaginationParams,
  PaginationState,
  SearchParamsRecord,
} from "@/lib/type";

export function formatPaginationSummary(
  pagination: Pick<
    PaginationState,
    "currentCount" | "startIndex" | "endIndex" | "totalCount"
  >,
) {
  return pagination.currentCount
    ? `Showing ${pagination.startIndex}-${pagination.endIndex} of ${pagination.totalCount}`
    : `Showing 0 of ${pagination.totalCount}`;
}

function normalizeSearchParamValue(value: string | string[] | undefined) {
  const resolvedValue = Array.isArray(value) ? value[0] : value;

  if (typeof resolvedValue !== "string") {
    return undefined;
  }

  const trimmedValue = resolvedValue.trim();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

const positiveIntegerParamSchema = z.preprocess((value) => {
  const normalizedValue = normalizeSearchParamValue(
    value as string | string[] | undefined,
  );

  if (normalizedValue === undefined) {
    return undefined;
  }

  return Number(normalizedValue);
}, z.number().int().min(1));

function parsePositiveInteger(
  value: string | string[] | undefined,
  fallback: number,
) {
  const result = positiveIntegerParamSchema.safeParse(value);

  return result.success ? result.data : fallback;
}

function isPageSizeOption(value: number): value is PageSizeOption {
  return PAGE_SIZE_OPTIONS.includes(value as PageSizeOption);
}

function getAllowedPageSizes(maxPageSize: number) {
  const allowedPageSizes = PAGE_SIZE_OPTIONS.filter(
    (pageSize) => pageSize <= maxPageSize,
  );

  return allowedPageSizes.length ? allowedPageSizes : [maxPageSize];
}

function normalizeDefaultPageSize(
  pageSize: number,
  allowedPageSizes: readonly number[],
) {
  const largestAllowedPageSize = allowedPageSizes[allowedPageSizes.length - 1];

  if (pageSize >= largestAllowedPageSize) {
    return largestAllowedPageSize;
  }

  return isPageSizeOption(pageSize) && allowedPageSizes.includes(pageSize)
    ? pageSize
    : allowedPageSizes[0];
}

function normalizeRequestedPageSize(
  pageSize: number,
  allowedPageSizes: readonly number[],
  fallbackPageSize: number,
) {
  const largestAllowedPageSize = allowedPageSizes[allowedPageSizes.length - 1];

  if (pageSize >= largestAllowedPageSize) {
    return largestAllowedPageSize;
  }

  return allowedPageSizes.includes(pageSize) ? pageSize : fallbackPageSize;
}

export function parsePaginationParams(
  searchParams: SearchParamsRecord | undefined,
  options: PaginationKeyOptions = {},
): PaginationParams {
  const pageKey = options.pageKey ?? "page";
  const pageSizeKey = options.pageSizeKey ?? "pageSize";
  const maxPageSize = Math.max(1, options.maxPageSize ?? MAX_PAGE_SIZE);
  const allowedPageSizes = getAllowedPageSizes(maxPageSize);
  const defaultPageSize = normalizeDefaultPageSize(
    Math.max(1, options.defaultPageSize ?? DEFAULT_PAGE_SIZE),
    allowedPageSizes,
  );
  const params = searchParams ?? {};
  const page = parsePositiveInteger(params[pageKey], 1);
  const pageSize = normalizeRequestedPageSize(
    parsePositiveInteger(params[pageSizeKey], defaultPageSize),
    allowedPageSizes,
    defaultPageSize,
  );

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
    pageKey,
    pageSizeKey,
  };
}

export function buildPaginationState(
  params: PaginationParams,
  totalCount: number,
): PaginationState {
  const normalizedTotalCount = Math.max(0, totalCount);
  const totalPages =
    normalizedTotalCount === 0
      ? 1
      : Math.ceil(normalizedTotalCount / params.pageSize);
  const currentCount = Math.min(
    params.pageSize,
    Math.max(normalizedTotalCount - params.skip, 0),
  );
  const startIndex = currentCount === 0 ? 0 : params.skip + 1;
  const endIndex = currentCount === 0 ? 0 : params.skip + currentCount;

  return {
    ...params,
    totalCount: normalizedTotalCount,
    totalPages,
    currentCount,
    startIndex,
    endIndex,
    hasPreviousPage: params.page > 1,
    hasNextPage: params.page < totalPages,
    isEmpty: normalizedTotalCount === 0,
  };
}
