import ChairPairingsPage from "@/app/chair/pairings/page";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type FilterableCardGridProps = {
  filterAllLabel: string;
  filters: Array<{ label: string; value: string }>;
  items: Array<{
    filters: string[];
    id: string;
    searchText: string;
  }>;
  pagination?: {
    currentCount: number;
    endIndex: number;
    page: number;
    pageKey: string;
    pageSize: number;
    pageSizeKey: string;
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
  children: React.ReactNode;
};

type PaginationNavProps = {
  label?: string;
  pagination: {
    currentCount: number;
    endIndex: number;
    page: number;
    pageKey: string;
    pageSize: number;
    pageSizeKey: string;
    startIndex: number;
    totalCount: number;
  };
  searchParams?: Record<string, string | string[] | undefined>;
};

const {
  filterableCardGrid,
  paginationNav,
  pairingGolferCard,
  pairingGroupCard,
  pairingGroupFindMany,
  participantFindMany,
  requireChairPageAuth,
} = vi.hoisted(() => ({
  filterableCardGrid: vi.fn(({ children }) =>
    createElement("section", null, children),
  ),
  paginationNav: vi.fn((_props: PaginationNavProps) =>
    createElement("nav", null, "pagination"),
  ),
  pairingGolferCard: vi.fn(({ golfer }) =>
    createElement("article", null, `${golfer.firstName} ${golfer.lastName}`),
  ),
  pairingGroupCard: vi.fn(({ group }) =>
    createElement("article", null, group.name),
  ),
  pairingGroupFindMany: vi.fn(),
  participantFindMany: vi.fn(),
  requireChairPageAuth: vi.fn(async () => undefined),
}));

vi.mock("@/app/actions/pairings", () => ({
  createPairingGroup: async () => {},
  generatePairings: async () => {},
  publishPairings: async () => {},
  unpublishPairings: async () => {},
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

vi.mock("@/components/PaginationNav", () => ({
  PaginationNav: (props: PaginationNavProps) => {
    paginationNav(props);
    return createElement("nav", null, props.label ?? "Results");
  },
}));

vi.mock("@/lib/chairAuth.server", () => ({
  requireChairPageAuth,
}));

vi.mock("@/app/chair/pairings/PairingGolferCard", () => ({
  PairingGolferCard: (props: {
    golfer: {
      firstName: string;
      id: string;
      lastName: string;
      pairingNote: string | null;
    };
  }) => {
    pairingGolferCard(props);
    return createElement(
      "article",
      null,
      `${props.golfer.firstName} ${props.golfer.lastName}`,
    );
  },
}));

vi.mock("@/app/chair/pairings/PairingGroupCard", () => ({
  PairingGroupCard: (props: { group: { name: string } }) => {
    pairingGroupCard(props);
    return createElement("article", null, props.group.name);
  },
}));

vi.mock("@/lib/db", () => ({
  db: {
    pairingGroup: {
      findMany: pairingGroupFindMany,
    },
    participant: {
      findMany: participantFindMany,
    },
  },
}));

vi.mock("@/lib/format", () => ({
  formatDateTime: (value: Date) => value.toISOString(),
}));

vi.mock("@/lib/payment", () => ({
  completeRegistrationPaymentStatuses: ["PAID"],
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

beforeEach(() => {
  pairingGroupFindMany
    .mockResolvedValueOnce([
      {
        id: "group-1",
        members: [
          {
            id: "member-1",
            participant: {
              firstName: "Alice",
              id: "golfer-assigned",
              lastName: "Assigned",
            },
            participantId: "golfer-assigned",
            slot: 1,
            snapshotAge: 72,
            snapshotGender: "FEMALE",
            snapshotScore: 38,
          },
        ],
        name: "Group 1",
        sortOrder: 1,
        status: "DRAFT",
        teeTime: null,
      },
      {
        id: "group-2",
        members: [],
        name: "Group 2",
        sortOrder: 2,
        status: "DRAFT",
        teeTime: new Date("2026-05-01T09:10:00.000Z"),
      },
    ])
    .mockResolvedValueOnce([
      {
        id: "published-1",
        members: [],
        name: "Published Group 1",
        sortOrder: 3,
        status: "PUBLISHED",
        teeTime: new Date("2026-05-01T10:00:00.000Z"),
      },
      {
        id: "published-2",
        members: [],
        name: "Published Group 2",
        sortOrder: 4,
        status: "PUBLISHED",
        teeTime: new Date("2026-05-01T10:10:00.000Z"),
      },
    ]);

  participantFindMany.mockResolvedValue([
    {
      age: 72,
      averageScore: 38,
      firstName: "Alice",
      gender: "FEMALE",
      id: "golfer-assigned",
      lastName: "Assigned",
      registrations: [{ notes: null }],
    },
    {
      age: 48,
      averageScore: 41,
      firstName: "Nora",
      gender: "FEMALE",
      id: "golfer-nora",
      lastName: "Neutral",
      registrations: [{ notes: null }],
    },
    {
      age: 60,
      averageScore: 40,
      firstName: "Beth",
      gender: "FEMALE",
      id: "golfer-beth",
      lastName: "Bird",
      registrations: [{ notes: null }],
    },
    {
      age: 75,
      averageScore: 39,
      firstName: "Uma",
      gender: "PREFER_NOT_TO_SAY",
      id: "golfer-uma",
      lastName: "Unset",
      registrations: [{ notes: null }],
    },
    {
      age: 54,
      averageScore: 44,
      firstName: "Mark",
      gender: "MALE",
      id: "golfer-mark",
      lastName: "Mulligan",
      registrations: [{ notes: "Keep with morning foursome if possible" }],
    },
    {
      age: 64,
      averageScore: 40,
      firstName: "Cara",
      gender: "FEMALE",
      id: "golfer-cara",
      lastName: "Caddie",
      registrations: [{ notes: null }],
    },
    {
      age: 62,
      averageScore: 39,
      firstName: "Liam",
      gender: "MALE",
      id: "golfer-liam",
      lastName: "Links",
      registrations: [{ notes: null }],
    },
  ]);
});

afterEach(() => {
  vi.clearAllMocks();
});

function buildPagedDraftGroups(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `group-${index + 1}`,
    members: [],
    name: `Group ${index + 1}`,
    sortOrder: index + 1,
    status: "DRAFT",
    teeTime: new Date(
      `2026-05-01T09:${String(index).padStart(2, "0")}:00.000Z`,
    ),
  }));
}

function buildPagedPublishedGroups(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `published-${index + 1}`,
    members: [],
    name: `Published Group ${index + 1}`,
    sortOrder: index + 1,
    status: "PUBLISHED",
    teeTime: new Date(
      `2026-05-01T10:${String(index).padStart(2, "0")}:00.000Z`,
    ),
  }));
}

function buildPagedMaleGolfers(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    age: 75 - index,
    averageScore: 35 + index,
    firstName: `Male ${index + 1}`,
    gender: "MALE",
    id: `male-${index + 1}`,
    lastName: `Golfer ${index + 1}`,
    registrations: [{ notes: null }],
  }));
}

describe("chair pairings page", () => {
  it("renders unassigned golfers in gender, score, then age order", async () => {
    const html = renderToStaticMarkup(
      await ChairPairingsPage({
        searchParams: Promise.resolve({}),
      }),
    );

    expect(html).toContain(
      "Unassigned golfers are ordered by gender, then score, then age.",
    );
    expect(html).toContain("Liam Links");
    expect(html).toContain("Mark Mulligan");
    expect(html).toContain("Cara Caddie");
    expect(html).toContain("Beth Bird");
    expect(html).toContain("Nora Neutral");
    expect(html).toContain("Uma Unset");
    expect(html).not.toContain("Alice Assigned");

    const golferGridProps = filterableCardGrid.mock.calls
      .map(([props]) => props as FilterableCardGridProps)
      .find((props) => props.resultLabel === "unassigned golfers");

    expect(golferGridProps).toBeDefined();
    expect(golferGridProps?.filterAllLabel).toBe("All unassigned golfers");
    expect(golferGridProps?.filters).toEqual([
      { value: "gender:MALE", label: "Male golfers" },
      { value: "gender:FEMALE", label: "Female golfers" },
    ]);
    expect(golferGridProps?.items.map((item) => item.id)).toEqual([
      "golfer-liam",
      "golfer-mark",
      "golfer-cara",
      "golfer-beth",
      "golfer-nora",
      "golfer-uma",
    ]);
    expect(
      pairingGolferCard.mock.calls.map(([props]) => props.golfer.id),
    ).toEqual([
      "golfer-liam",
      "golfer-mark",
      "golfer-cara",
      "golfer-beth",
      "golfer-nora",
      "golfer-uma",
    ]);
    expect(
      pairingGolferCard.mock.calls.find(
        ([props]) => props.golfer.id === "golfer-mark",
      )?.[0].golfer.pairingNote,
    ).toBe("Keep with morning foursome if possible");
    expect(participantFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          registrations: {
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            select: { notes: true },
            take: 1,
          },
        },
      }),
    );
  });

  it("keeps pairings pagination and filter state independent across all three lists", async () => {
    pairingGroupFindMany.mockReset();
    pairingGroupFindMany
      .mockResolvedValueOnce(buildPagedDraftGroups(11))
      .mockResolvedValueOnce(buildPagedPublishedGroups(11));
    participantFindMany.mockResolvedValue(buildPagedMaleGolfers(11));

    renderToStaticMarkup(
      await ChairPairingsPage({
        searchParams: Promise.resolve({
          draftFilter: "capacity:open",
          draftPage: "2",
          draftPageSize: "10",
          publishedFilter: "tee:yes",
          publishedPage: "2",
          publishedPageSize: "10",
          unassignedFilter: "gender:male",
          unassignedPage: "2",
          unassignedPageSize: "10",
        }),
      }),
    );

    const golferGridProps = filterableCardGrid.mock.calls
      .map(([props]) => props as FilterableCardGridProps)
      .find((props) => props.resultLabel === "unassigned golfers");
    const draftGridProps = filterableCardGrid.mock.calls
      .map(([props]) => props as FilterableCardGridProps)
      .find((props) => props.resultLabel === "draft groups");
    const publishedGridProps = filterableCardGrid.mock.calls
      .map(([props]) => props as FilterableCardGridProps)
      .find((props) => props.resultLabel === "published groups");

    expect(golferGridProps?.items).toHaveLength(1);
    expect(golferGridProps?.pagination).toEqual(
      expect.objectContaining({
        endIndex: 11,
        page: 2,
        pageKey: "unassignedPage",
        pageSize: 10,
        pageSizeKey: "unassignedPageSize",
        startIndex: 11,
        totalCount: 11,
      }),
    );
    expect(golferGridProps?.urlBackedFilter).toEqual({
      value: "gender:MALE",
      searchParams: {
        draftFilter: "capacity:open",
        draftPage: "2",
        draftPageSize: "10",
        publishedFilter: "tee:yes",
        publishedPage: "2",
        publishedPageSize: "10",
        unassignedFilter: "gender:MALE",
        unassignedPage: "2",
        unassignedPageSize: "10",
      },
      filterParamKey: "unassignedFilter",
      pageParamKey: "unassignedPage",
    });

    expect(draftGridProps?.items).toHaveLength(1);
    expect(draftGridProps?.pagination).toEqual(
      expect.objectContaining({
        endIndex: 11,
        page: 2,
        pageKey: "draftPage",
        pageSize: 10,
        pageSizeKey: "draftPageSize",
        startIndex: 11,
        totalCount: 11,
      }),
    );
    expect(draftGridProps?.urlBackedFilter).toEqual({
      value: "capacity:open",
      searchParams: {
        draftFilter: "capacity:open",
        draftPage: "2",
        draftPageSize: "10",
        publishedFilter: "tee:yes",
        publishedPage: "2",
        publishedPageSize: "10",
        unassignedFilter: "gender:MALE",
        unassignedPage: "2",
        unassignedPageSize: "10",
      },
      filterParamKey: "draftFilter",
      pageParamKey: "draftPage",
    });

    expect(publishedGridProps?.items).toHaveLength(1);
    expect(publishedGridProps?.pagination).toEqual(
      expect.objectContaining({
        endIndex: 11,
        page: 2,
        pageKey: "publishedPage",
        pageSize: 10,
        pageSizeKey: "publishedPageSize",
        startIndex: 11,
        totalCount: 11,
      }),
    );
    expect(publishedGridProps?.urlBackedFilter).toEqual({
      value: "tee:yes",
      searchParams: {
        draftFilter: "capacity:open",
        draftPage: "2",
        draftPageSize: "10",
        publishedFilter: "tee:yes",
        publishedPage: "2",
        publishedPageSize: "10",
        unassignedFilter: "gender:MALE",
        unassignedPage: "2",
        unassignedPageSize: "10",
      },
      filterParamKey: "publishedFilter",
      pageParamKey: "publishedPage",
    });

    expect(paginationNav).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "Unassigned golfers",
        pagination: expect.objectContaining({
          pageKey: "unassignedPage",
          totalCount: 11,
        }),
        searchParams: expect.objectContaining({
          unassignedPage: "2",
          draftPage: "2",
          publishedPage: "2",
        }),
      }),
    );
    expect(paginationNav).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "Draft groups",
        pagination: expect.objectContaining({
          pageKey: "draftPage",
          totalCount: 11,
        }),
      }),
    );
    expect(paginationNav).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "Published groups",
        pagination: expect.objectContaining({
          pageKey: "publishedPage",
          totalCount: 11,
        }),
      }),
    );
  });

  it("clamps an out-of-range section page to the last available pairings page", async () => {
    participantFindMany.mockResolvedValue(buildPagedMaleGolfers(11));

    renderToStaticMarkup(
      await ChairPairingsPage({
        searchParams: Promise.resolve({
          unassignedFilter: "gender:male",
          unassignedPage: "99",
          unassignedPageSize: "10",
        }),
      }),
    );

    const golferGridProps = filterableCardGrid.mock.calls
      .map(([props]) => props as FilterableCardGridProps)
      .find((props) => props.resultLabel === "unassigned golfers");

    expect(golferGridProps?.items).toHaveLength(1);
    expect(golferGridProps?.pagination).toEqual(
      expect.objectContaining({
        endIndex: 11,
        page: 2,
        pageKey: "unassignedPage",
        pageSize: 10,
        startIndex: 11,
        totalCount: 11,
      }),
    );
  });
});
