import { afterEach, describe, expect, it, vi } from "vitest";

const {
  feedbackCount,
  pairingGroupCount,
  photoSubmissionCount,
  registrationCount,
  rsvpCount,
} = vi.hoisted(() => ({
  feedbackCount: vi.fn(),
  pairingGroupCount: vi.fn(),
  photoSubmissionCount: vi.fn(),
  registrationCount: vi.fn(),
  rsvpCount: vi.fn(),
}));

vi.mock("@/app/chair/chair.module.css", () => ({
  default: {},
}));

vi.mock("next/link", () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/lib/db", () => ({
  db: {
    registration: {
      count: registrationCount,
    },
    rsvp: {
      count: rsvpCount,
    },
    feedback: {
      count: feedbackCount,
    },
    photoSubmission: {
      count: photoSubmissionCount,
    },
    pairingGroup: {
      count: pairingGroupCount,
    },
  },
}));

import ChairDashboardPage from "@/app/chair/page";
import { REMEMBRANCE_FEEDBACK_CATEGORY } from "@/lib/remembrance";

afterEach(() => {
  vi.clearAllMocks();
});

describe("chair dashboard page", () => {
  it("excludes remembrance entries from the feedback count", async () => {
    registrationCount.mockResolvedValue(0);
    rsvpCount.mockResolvedValue(0);
    feedbackCount.mockResolvedValue(0);
    photoSubmissionCount.mockResolvedValue(0);
    pairingGroupCount.mockResolvedValue(0);

    await ChairDashboardPage();

    expect(feedbackCount).toHaveBeenCalledWith({
      where: {
        category: {
          not: REMEMBRANCE_FEEDBACK_CATEGORY,
        },
      },
    });
  });
});
