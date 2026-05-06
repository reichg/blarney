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
  resultLabel: string;
  children: React.ReactNode;
};

const {
  filterableCardGrid,
  pairingGolferCard,
  pairingGroupCard,
  pairingGroupFindMany,
  participantFindMany,
} = vi.hoisted(() => ({
  filterableCardGrid: vi.fn(({ children }) =>
    createElement("section", null, children),
  ),
  pairingGolferCard: vi.fn(({ golfer }) =>
    createElement("article", null, `${golfer.firstName} ${golfer.lastName}`),
  ),
  pairingGroupCard: vi.fn(({ group }) =>
    createElement("article", null, group.name),
  ),
  pairingGroupFindMany: vi.fn(),
  participantFindMany: vi.fn(),
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

vi.mock("@/app/chair/pairings/PairingGolferCard", () => ({
  PairingGolferCard: (props: {
    golfer: { firstName: string; id: string; lastName: string };
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
    ])
    .mockResolvedValueOnce([]);

  participantFindMany.mockResolvedValue([
    {
      age: 72,
      averageScore: 38,
      firstName: "Alice",
      gender: "FEMALE",
      id: "golfer-assigned",
      lastName: "Assigned",
    },
    {
      age: 48,
      averageScore: 41,
      firstName: "Nora",
      gender: "NON_BINARY",
      id: "golfer-nora",
      lastName: "Neutral",
    },
    {
      age: 60,
      averageScore: 40,
      firstName: "Beth",
      gender: "FEMALE",
      id: "golfer-beth",
      lastName: "Bird",
    },
    {
      age: 75,
      averageScore: 39,
      firstName: "Uma",
      gender: "PREFER_NOT_TO_SAY",
      id: "golfer-uma",
      lastName: "Unset",
    },
    {
      age: 54,
      averageScore: 44,
      firstName: "Mark",
      gender: "MALE",
      id: "golfer-mark",
      lastName: "Mulligan",
    },
    {
      age: 64,
      averageScore: 40,
      firstName: "Cara",
      gender: "FEMALE",
      id: "golfer-cara",
      lastName: "Caddie",
    },
    {
      age: 62,
      averageScore: 39,
      firstName: "Liam",
      gender: "MALE",
      id: "golfer-liam",
      lastName: "Links",
    },
  ]);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("chair pairings page", () => {
  it("renders unassigned golfers in gender, score, then age order", async () => {
    const html = renderToStaticMarkup(
      await ChairPairingsPage({
        searchParams: Promise.resolve({}),
      }),
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
      { value: "gender:NON_BINARY", label: "Non-binary golfers" },
      { value: "gender:PREFER_NOT_TO_SAY", label: "Prefer not to say" },
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
  });
});
