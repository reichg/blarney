import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ChairDashboardInsights } from "@/lib/chairDashboard";

vi.mock("server-only", () => ({}));

const { getChairDashboardInsights, cookies, redirect, verifyChairToken } =
  vi.hoisted(() => ({
    getChairDashboardInsights: vi.fn(),
    cookies: vi.fn(),
    redirect: vi.fn((path: string) => {
      throw new Error(`REDIRECT:${path}`);
    }),
    verifyChairToken: vi.fn(),
  }));

function createStyleProxy() {
  return new Proxy(
    {},
    {
      get: (_, key) => String(key),
    },
  );
}

function createEmptyInsights(): ChairDashboardInsights {
  return {
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
  };
}

vi.mock("@/lib/auth", () => ({
  CHAIR_COOKIE: "blarney_chair_session",
  verifyChairToken,
}));

vi.mock("@/lib/chairDashboard", () => ({
  getChairDashboardInsights,
}));

vi.mock("next/headers", () => ({
  cookies,
}));

vi.mock("next/navigation", () => ({
  redirect,
}));

vi.mock("next/link", () => ({
  default: ({ children, className, href }: React.ComponentProps<"a">) =>
    createElement("a", { className, href }, children),
}));

vi.mock("@/app/chair/chair.module.css", () => ({
  default: createStyleProxy(),
}));

import ChairDashboardPage from "@/app/chair/page";

beforeEach(() => {
  cookies.mockResolvedValue({
    get: vi.fn().mockReturnValue({ value: "chair-token" }),
  });
  verifyChairToken.mockResolvedValue(true);
  getChairDashboardInsights.mockResolvedValue(createEmptyInsights());
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("ChairDashboardPage", () => {
  it("redirects to chair login before loading dashboard data when auth is missing", async () => {
    cookies.mockResolvedValue({
      get: vi.fn().mockReturnValue(undefined),
    });
    verifyChairToken.mockResolvedValue(false);

    await expect(ChairDashboardPage()).rejects.toThrow(
      "REDIRECT:/chair/login?next=%2Fchair",
    );

    expect(getChairDashboardInsights).not.toHaveBeenCalled();
  });

  it("loads dashboard insights once and renders when auth passes", async () => {
    await expect(ChairDashboardPage()).resolves.toBeDefined();

    expect(getChairDashboardInsights).toHaveBeenCalledTimes(1);
  });
});
