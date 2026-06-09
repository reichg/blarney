import {
  getChairDashboardInsights,
  type ChairDashboardInsights,
} from "@/lib/chairDashboard";
import { afterEach, describe, expect, it, vi } from "vitest";

const { getChairMarketplaceOverview, getChairMarketplaceCatalog } = vi.hoisted(
  () => ({
    getChairMarketplaceOverview: vi.fn(),
    getChairMarketplaceCatalog: vi.fn(),
  }),
);

// chairDashboard imports `db` (default client) and these helpers. The helpers
// are mocked because they are not the unit under test; `db` is mocked to a
// harmless object since every test passes an explicit mock client instead.
vi.mock("@/lib/db", () => ({ db: {} }));

vi.mock("@/lib/marketplaceChair", () => ({ getChairMarketplaceOverview }));

vi.mock("@/lib/marketplaceCatalogAdmin", () => ({ getChairMarketplaceCatalog }));

// sumChairRsvpPartyCounts is imported by chairDashboard; the real
// implementation is exercised by its own suite. Here we use the real summation
// so attendee mapping stays faithful to production behavior.
vi.mock("@/lib/chairRsvps", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/chairRsvps")>(
      "@/lib/chairRsvps",
    );
  return { sumChairRsvpPartyCounts: actual.sumChairRsvpPartyCounts };
});

type RegistrationBreakdownRow = {
  adultGuestCount: number;
  childGuestCount: number;
  participant: { age: number };
};

type MockClientOptions = {
  completeRegistrationCount?: number;
  pendingPaymentRegistrationCount?: number;
  registrationBreakdownRows?: RegistrationBreakdownRow[];
  rsvpTotal?: number;
  rsvpPartyRows?: unknown[];
  feedbackTotal?: number;
  feedbackAvgRating?: number | null;
  pendingPhotoCount?: number;
  approvedPhotoCount?: number;
  remembranceTotal?: number;
  draftPairingCount?: number;
  publishedPairingCount?: number;
  assignedPaidGolferCount?: number;
};

type DashboardClient = Parameters<typeof getChairDashboardInsights>[0];

// Builds a mock Prisma-like client. registration.count is called three times in
// order: complete, pendingPayment, assignedPaidGolfer. We dispatch by the
// `where` shape so order changes in the helper do not silently break tests. The
// helper only touches the handful of delegate methods below, so we expose just
// those and cast to the full client type at the boundary.
function buildMockClient(options: MockClientOptions = {}) {
  const {
    completeRegistrationCount = 0,
    pendingPaymentRegistrationCount = 0,
    registrationBreakdownRows = [],
    rsvpTotal = 0,
    rsvpPartyRows = [],
    feedbackTotal = 0,
    feedbackAvgRating = null,
    pendingPhotoCount = 0,
    approvedPhotoCount = 0,
    remembranceTotal = 0,
    draftPairingCount = 0,
    publishedPairingCount = 0,
    assignedPaidGolferCount = 0,
  } = options;

  return {
    registration: {
      count: vi.fn(async (args: { where?: Record<string, unknown> }) => {
        const where = args?.where ?? {};
        if (where.paymentStatus === "EXTERNAL_PENDING") {
          return pendingPaymentRegistrationCount;
        }
        if ("participant" in where) {
          return assignedPaidGolferCount;
        }
        return completeRegistrationCount;
      }),
      findMany: vi.fn(async () => registrationBreakdownRows),
    },
    rsvp: {
      count: vi.fn(async () => rsvpTotal),
      findMany: vi.fn(async () => rsvpPartyRows),
    },
    feedback: {
      count: vi.fn(async (args: { where?: Record<string, unknown> }) => {
        const category = args?.where?.category as
          | { not?: string }
          | string
          | undefined;
        // Remembrance count uses an equality match (a plain string), the
        // general feedback count uses `{ not: REMEMBRANCE_FEEDBACK_CATEGORY }`.
        if (typeof category === "string") {
          return remembranceTotal;
        }
        return feedbackTotal;
      }),
      aggregate: vi.fn(async () => ({ _avg: { rating: feedbackAvgRating } })),
    },
    photoSubmission: {
      count: vi.fn(async (args: { where?: { status?: string } }) => {
        if (args?.where?.status === "PENDING") {
          return pendingPhotoCount;
        }
        return approvedPhotoCount;
      }),
    },
    pairingGroup: {
      count: vi.fn(async (args: { where?: { status?: string } }) => {
        if (args?.where?.status === "DRAFT") {
          return draftPairingCount;
        }
        return publishedPairingCount;
      }),
    },
  };
}

const overview = (
  counts: {
    review: number;
    unfulfilled: number;
    ready: number;
    fulfilled: number;
  },
) => ({ counts });

// The helper's parameter is typed as the full PrismaClient; our mock only
// implements the delegates it uses, so cast through the function's own
// parameter type at the single invocation boundary.
function invoke(client: ReturnType<typeof buildMockClient>) {
  return getChairDashboardInsights(client as unknown as DashboardClient);
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("getChairDashboardInsights", () => {
  it("maps mocked queries and helpers onto the ChairDashboardInsights contract", async () => {
    getChairMarketplaceOverview.mockResolvedValue(
      overview({ review: 3, unfulfilled: 5, ready: 2, fulfilled: 9 }),
    );
    getChairMarketplaceCatalog.mockResolvedValue([
      { status: "ACTIVE" },
      { status: "ACTIVE" },
      { status: "DRAFT" },
      { status: "SOLD" },
    ]);

    const client = buildMockClient({
      completeRegistrationCount: 12,
      pendingPaymentRegistrationCount: 4,
      registrationBreakdownRows: [
        { adultGuestCount: 1, childGuestCount: 0, participant: { age: 40 } },
        { adultGuestCount: 0, childGuestCount: 2, participant: { age: 10 } },
      ],
      rsvpTotal: 7,
      // Two explicit-count RSVP rows: 2+1 adults, 1+0 kids, 3+1 attendees.
      rsvpPartyRows: [
        {
          source: "FORM",
          adultAttendeeCount: 2,
          childAttendeeCount: 1,
          attendeeCount: 3,
          participant: null,
        },
        {
          source: "FORM",
          adultAttendeeCount: 1,
          childAttendeeCount: 0,
          attendeeCount: 1,
          participant: null,
        },
      ],
      feedbackTotal: 6,
      feedbackAvgRating: 4.25,
      pendingPhotoCount: 8,
      approvedPhotoCount: 20,
      remembranceTotal: 11,
      draftPairingCount: 2,
      publishedPairingCount: 3,
      assignedPaidGolferCount: 5,
    });

    const result = await invoke(client);

    const expected: ChairDashboardInsights = {
      registrations: {
        complete: 12,
        pendingPayment: 4,
        golfers: { adults: 1, kids: 1, total: 2 },
        guests: { adults: 1, kids: 2, total: 3 },
      },
      rsvps: {
        total: 7,
        adultAttendees: 3,
        kidAttendees: 1,
        totalAttendees: 4,
      },
      marketplace: {
        needsReview: 3,
        unfulfilled: 5,
        ready: 2,
        fulfilled: 9,
        activeListings: 2,
        draftListings: 1,
      },
      feedback: { total: 6, averageRating: 4.25 },
      photos: { pending: 8, approved: 20 },
      remembrance: { total: 11 },
      pairings: {
        paidGolfers: 12,
        unassigned: 7,
        draft: 2,
        published: 3,
      },
    };

    expect(result).toEqual(expected);
    expect(getChairMarketplaceOverview).toHaveBeenCalledWith(client);
    expect(getChairMarketplaceCatalog).toHaveBeenCalledWith(client);
  });

  it("splits golfers on the age >= 15 threshold and sums guest counts", async () => {
    getChairMarketplaceOverview.mockResolvedValue(
      overview({ review: 0, unfulfilled: 0, ready: 0, fulfilled: 0 }),
    );
    getChairMarketplaceCatalog.mockResolvedValue([]);

    const client = buildMockClient({
      registrationBreakdownRows: [
        // Exactly 15 is an adult (>= threshold).
        { adultGuestCount: 2, childGuestCount: 1, participant: { age: 15 } },
        // 14 falls below the threshold -> kid.
        { adultGuestCount: 1, childGuestCount: 3, participant: { age: 14 } },
        // Clear adult.
        { adultGuestCount: 0, childGuestCount: 0, participant: { age: 60 } },
      ],
    });

    const result = await invoke(client);

    expect(result.registrations.golfers).toEqual({
      adults: 2,
      kids: 1,
      total: 3,
    });
    expect(result.registrations.guests).toEqual({
      adults: 3,
      kids: 4,
      total: 7,
    });
  });

  it("clamps unassigned paid golfers to zero when more are assigned than are paid", async () => {
    getChairMarketplaceOverview.mockResolvedValue(
      overview({ review: 0, unfulfilled: 0, ready: 0, fulfilled: 0 }),
    );
    getChairMarketplaceCatalog.mockResolvedValue([]);

    const client = buildMockClient({
      completeRegistrationCount: 4,
      assignedPaidGolferCount: 9,
    });

    const result = await invoke(client);

    expect(result.pairings.paidGolfers).toBe(4);
    expect(result.pairings.unassigned).toBe(0);
  });

  it("computes unassigned paid golfers as the positive difference", async () => {
    getChairMarketplaceOverview.mockResolvedValue(
      overview({ review: 0, unfulfilled: 0, ready: 0, fulfilled: 0 }),
    );
    getChairMarketplaceCatalog.mockResolvedValue([]);

    const client = buildMockClient({
      completeRegistrationCount: 10,
      assignedPaidGolferCount: 6,
    });

    const result = await invoke(client);

    expect(result.pairings.unassigned).toBe(4);
  });

  it("returns a null average rating when no rated feedback exists", async () => {
    getChairMarketplaceOverview.mockResolvedValue(
      overview({ review: 0, unfulfilled: 0, ready: 0, fulfilled: 0 }),
    );
    getChairMarketplaceCatalog.mockResolvedValue([]);

    const client = buildMockClient({
      feedbackTotal: 0,
      feedbackAvgRating: null,
    });

    const result = await invoke(client);

    expect(result.feedback).toEqual({ total: 0, averageRating: null });
  });

  it("passes through a numeric average rating", async () => {
    getChairMarketplaceOverview.mockResolvedValue(
      overview({ review: 0, unfulfilled: 0, ready: 0, fulfilled: 0 }),
    );
    getChairMarketplaceCatalog.mockResolvedValue([]);

    const client = buildMockClient({
      feedbackTotal: 3,
      feedbackAvgRating: 3.5,
    });

    const result = await invoke(client);

    expect(result.feedback).toEqual({ total: 3, averageRating: 3.5 });
  });

  it("returns the zeroed contract without throwing when a query fails", async () => {
    getChairMarketplaceOverview.mockResolvedValue(
      overview({ review: 1, unfulfilled: 1, ready: 1, fulfilled: 1 }),
    );
    getChairMarketplaceCatalog.mockResolvedValue([{ status: "ACTIVE" }]);

    const client = buildMockClient();
    client.registration.findMany.mockRejectedValueOnce(
      new Error("database unavailable"),
    );

    const result = await invoke(client);

    expect(result).toEqual({
      registrations: {
        complete: 0,
        pendingPayment: 0,
        golfers: { adults: 0, kids: 0, total: 0 },
        guests: { adults: 0, kids: 0, total: 0 },
      },
      rsvps: {
        total: 0,
        adultAttendees: 0,
        kidAttendees: 0,
        totalAttendees: 0,
      },
      marketplace: {
        needsReview: 0,
        unfulfilled: 0,
        ready: 0,
        fulfilled: 0,
        activeListings: 0,
        draftListings: 0,
      },
      feedback: { total: 0, averageRating: null },
      photos: { pending: 0, approved: 0 },
      remembrance: { total: 0 },
      pairings: {
        paidGolfers: 0,
        unassigned: 0,
        draft: 0,
        published: 0,
      },
    });
  });
});
