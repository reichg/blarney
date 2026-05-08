import ChairRsvpsPage from "@/app/chair/rsvps/page";
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
  requireChairPageAuth,
  rsvpCount,
  rsvpFindMany,
} = vi.hoisted(() => ({
  filterableCardGrid: vi.fn(({ children }) =>
    createElement("section", null, children),
  ),
  paginationNav: vi.fn((_: PaginationNavProps) =>
    createElement("nav", null, "pagination"),
  ),
  requireChairPageAuth: vi.fn(async () => {}),
  rsvpCount: vi.fn(),
  rsvpFindMany: vi.fn(),
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

vi.mock("@/lib/db", () => ({
  db: {
    rsvp: {
      count: rsvpCount,
      findMany: rsvpFindMany,
    },
  },
}));

vi.mock("@/lib/format", () => ({
  formatDateTime: (value: Date) => value.toISOString(),
}));

describe("chair RSVPs page", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows overall attendee totals while keeping filtered totals visible in the header", async () => {
    const pageRow = {
      attendeeCount: 3,
      adultAttendeeCount: 2,
      childAttendeeCount: 1,
      createdAt: new Date("2026-05-01T12:00:00.000Z"),
      dietaryNotes: null,
      email: "ada@example.com",
      familyNames: "Lovelace family",
      firstName: "Ada",
      id: "rsvp-1",
      lastName: "Lovelace",
      notes: "Bringing salad",
      participant: null,
      source: "FORM",
    };
    rsvpFindMany.mockImplementation(async (args) => {
      if ("include" in args) {
        return [pageRow];
      }

      if (JSON.stringify(args.where) === JSON.stringify({ source: "FORM" })) {
        return [
          {
            attendeeCount: 3,
            adultAttendeeCount: 2,
            childAttendeeCount: 1,
            participant: null,
            source: "FORM",
          },
        ];
      }

      return [
        {
          attendeeCount: 3,
          adultAttendeeCount: 2,
          childAttendeeCount: 1,
          participant: null,
          source: "FORM",
        },
        {
          attendeeCount: 2,
          adultAttendeeCount: null,
          childAttendeeCount: null,
          participant: {
            age: 13,
            registrations: [{ adultGuestCount: 1, childGuestCount: 0 }],
          },
          source: "REGISTRATION",
        },
      ];
    });
    rsvpCount.mockResolvedValue(51);

    const html = renderToStaticMarkup(
      await ChairRsvpsPage({
        searchParams: Promise.resolve({
          filter: "source:form",
          page: "2",
        }),
      }),
    );

    expect(html).toContain("3 adult attendees overall (2 in selected filter)");
    expect(html).toContain("2 kid attendees overall (1 in selected filter)");

    expect(requireChairPageAuth).toHaveBeenCalledWith("/chair/rsvps");
    expect(rsvpFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
        where: {
          source: "FORM",
        },
      }),
    );
    expect(rsvpCount).toHaveBeenCalledWith({
      where: {
        source: "FORM",
      },
    });
    expect(
      rsvpFindMany.mock.calls.some(
        ([args]) =>
          "select" in args && JSON.stringify(args.where) === JSON.stringify({}),
      ),
    ).toBe(true);

    const gridProps = filterableCardGrid.mock.calls[0]?.[0] as
      | FilterableCardGridProps
      | undefined;
    expect(gridProps?.resultLabel).toBe("RSVPs");
    expect(gridProps?.pagination).toEqual(
      expect.objectContaining({
        currentCount: 10,
        endIndex: 20,
        startIndex: 11,
        totalCount: 51,
      }),
    );
    expect(gridProps?.urlBackedFilter).toEqual({
      value: "source:FORM",
      searchParams: {
        filter: "source:FORM",
        page: "2",
      },
      filterParamKey: "filter",
      pageParamKey: "page",
    });

    expect(paginationNav).toHaveBeenCalledWith(
      expect.objectContaining({
        pagination: expect.objectContaining({
          currentCount: 10,
          endIndex: 20,
          startIndex: 11,
          totalCount: 51,
        }),
        label: "RSVPs",
        searchParams: {
          filter: "source:FORM",
          page: "2",
        },
      }),
    );
  });
});
