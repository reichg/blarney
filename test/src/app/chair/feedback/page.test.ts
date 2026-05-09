import { afterEach, describe, expect, it, vi } from "vitest";

const { feedbackCount, feedbackFindMany, requireChairPageAuth } = vi.hoisted(
  () => ({
    feedbackCount: vi.fn(),
    feedbackFindMany: vi.fn(),
    requireChairPageAuth: vi.fn(async () => undefined),
  }),
);

vi.mock("@/app/chair/chair.module.css", () => ({
  default: {},
}));

vi.mock("@/components/PaginationNav", () => ({
  PaginationNav: () => null,
}));

vi.mock("@/lib/chairAuth.server", () => ({
  requireChairPageAuth,
}));

vi.mock("@/lib/db", () => ({
  db: {
    feedback: {
      count: feedbackCount,
      findMany: feedbackFindMany,
    },
  },
}));

import ChairFeedbackPage from "@/app/chair/feedback/page";
import { REMEMBRANCE_FEEDBACK_CATEGORY } from "@/lib/remembrance";

afterEach(() => {
  vi.clearAllMocks();
});

describe("chair feedback page", () => {
  it("excludes remembrance entries from the feedback listing query", async () => {
    feedbackFindMany.mockResolvedValue([]);
    feedbackCount.mockResolvedValue(0);

    await ChairFeedbackPage({
      searchParams: Promise.resolve({}),
    });

    expect(requireChairPageAuth).toHaveBeenCalledWith("/chair/feedback");

    expect(feedbackFindMany).toHaveBeenCalledWith({
      where: {
        category: {
          not: REMEMBRANCE_FEEDBACK_CATEGORY,
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: 0,
      take: 10,
    });
    expect(feedbackCount).toHaveBeenCalledWith({
      where: {
        category: {
          not: REMEMBRANCE_FEEDBACK_CATEGORY,
        },
      },
    });
  });
});
