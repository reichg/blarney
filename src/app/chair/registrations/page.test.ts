import ChairRegistrationsPage from "@/app/chair/registrations/page";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

type FilterableCardGridProps = {
  children: React.ReactNode;
  pagination?: {
    currentCount: number;
    endIndex: number;
    startIndex: number;
    totalCount: number;
  };
  resultLabel: string;
  urlBackedFilter?: {
    value: string;
    searchParams: Record<string, string | string[] | undefined>;
    filterParamKey?: string;
    pageParamKey?: string;
  };
};

type PaginationNavProps = {
  pagination: {
    totalCount: number;
  };
  searchParams?: Record<string, string | string[] | undefined>;
  label?: string;
};

const {
  filterableCardGrid,
  paginationNav,
  registrationCount,
  registrationFindMany,
  requireChairPageAuth,
} = vi.hoisted(() => ({
  filterableCardGrid: vi.fn(({ children }) =>
    createElement("section", null, children),
  ),
  paginationNav: vi.fn(() => createElement("nav", null, "pagination")),
  registrationCount: vi.fn(),
  registrationFindMany: vi.fn(),
  requireChairPageAuth: vi.fn(async () => {}),
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
  uniqueFilterOptions: <T>(items: T[]) => items,
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

vi.mock("@/lib/db", () => ({
  db: {
    registration: {
      count: registrationCount,
      findMany: registrationFindMany,
    },
  },
}));

vi.mock("@/lib/format", () => ({
  formatDateTime: (value: Date) => value.toISOString(),
}));

describe("chair registrations page", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("applies the active filter to pagination and the URL-backed grid state", async () => {
    const registrationRow = {
      adultGuestCount: 0,
      checkout: { email: "ada@example.com" },
      childGuestCount: 0,
      createdAt: new Date("2026-05-01T12:00:00.000Z"),
      dayBeforeRsvp: false,
      id: "registration-1",
      notes: "Pairing note",
      packageSelection: "Golf registration",
      participant: {
        age: 54,
        averageScore: 44,
        email: "ada@example.com",
        firstName: "Ada",
        gender: "MALE",
        lastName: "Lovelace",
        phone: "555-0100",
      },
      paymentReference: null,
      paymentStatus: "CONFIRMED",
      updatedAt: new Date("2026-05-01T12:30:00.000Z"),
    };
    registrationFindMany.mockImplementation(async (args) => {
      if ("include" in args) {
        return [registrationRow];
      }

      if (
        JSON.stringify(args.where) ===
        JSON.stringify({ participant: { gender: "MALE" } })
      ) {
        return [
          {
            adultGuestCount: 0,
            childGuestCount: 0,
            participant: {
              age: 54,
              gender: "MALE",
            },
          },
        ];
      }

      return [
        {
          adultGuestCount: 0,
          childGuestCount: 0,
          participant: {
            age: 54,
            gender: "MALE",
          },
        },
        {
          adultGuestCount: 1,
          childGuestCount: 2,
          participant: {
            age: 13,
            gender: "FEMALE",
          },
        },
        {
          adultGuestCount: 0,
          childGuestCount: 0,
          participant: {
            age: 37,
            gender: "NON_BINARY",
          },
        },
      ];
    });
    registrationCount.mockImplementation(async (args) => {
      if (
        JSON.stringify(args?.where) ===
        JSON.stringify({ participant: { gender: "MALE" } })
      ) {
        return 51;
      }

      return 120;
    });

    const html = renderToStaticMarkup(
      await ChairRegistrationsPage({
        searchParams: Promise.resolve({
          filter: "gender:male",
          page: "2",
        }),
      }),
    );

    expect(html).toContain("120 registrations overall (51 in selected filter)");
    expect(html).toContain(
      "Adult golfers overall: 1 male, 0 female, 1 other/unspecified (selected filter: 1 male, 0 female)",
    );
    expect(html).toContain(
      "Kid golfers overall: 0 male, 1 female (selected filter: 0 male, 0 female)",
    );
    expect(html).toContain(
      "Guests overall: 3 total, 1 adult, 2 kids (selected filter: 0 total, 0 adults, 0 kids)",
    );

    expect(requireChairPageAuth).toHaveBeenCalledWith("/chair/registrations");
    expect(registrationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 50,
        take: 50,
        where: {
          participant: {
            gender: "MALE",
          },
        },
      }),
    );
    expect(registrationCount).toHaveBeenCalledWith({
      where: {
        participant: {
          gender: "MALE",
        },
      },
    });
    expect(registrationCount).toHaveBeenCalledWith({ where: {} });

    const gridProps = filterableCardGrid.mock.calls[0]?.[0] as
      | FilterableCardGridProps
      | undefined;
    expect(gridProps?.resultLabel).toBe("registrations");
    expect(gridProps?.pagination).toEqual(
      expect.objectContaining({
        currentCount: 1,
        endIndex: 51,
        startIndex: 51,
        totalCount: 51,
      }),
    );
    expect(gridProps?.urlBackedFilter).toEqual({
      value: "gender:MALE",
      searchParams: {
        filter: "gender:MALE",
        page: "2",
      },
      filterParamKey: "filter",
      pageParamKey: "page",
    });

    expect(paginationNav).toHaveBeenCalledWith(
      expect.objectContaining({
        pagination: expect.objectContaining({
          currentCount: 1,
          endIndex: 51,
          startIndex: 51,
          totalCount: 51,
        }),
        label: "Registrations",
        searchParams: {
          filter: "gender:MALE",
          page: "2",
        },
      }),
    );
  });
});
