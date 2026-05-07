import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const {
  registrationCount,
  rsvpCount,
  feedbackCount,
  photoSubmissionCount,
  pairingGroupCount,
  cookies,
  redirect,
  verifyChairToken,
} = vi.hoisted(() => ({
  registrationCount: vi.fn(),
  rsvpCount: vi.fn(),
  feedbackCount: vi.fn(),
  photoSubmissionCount: vi.fn(),
  pairingGroupCount: vi.fn(),
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

vi.mock("@/lib/auth", () => ({
  CHAIR_COOKIE: "blarney_chair_session",
  verifyChairToken,
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

vi.mock("./chair.module.css", () => ({
  default: createStyleProxy(),
}));

vi.mock("@/lib/payment", () => ({
  completeRegistrationPaymentStatuses: ["CONFIRMED", "WAIVED"],
}));

vi.mock("@/lib/remembrance", () => ({
  REMEMBRANCE_FEEDBACK_CATEGORY: "In Remembrance",
}));

import ChairDashboardPage from "@/app/chair/page";

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

    expect(registrationCount).not.toHaveBeenCalled();
    expect(rsvpCount).not.toHaveBeenCalled();
    expect(feedbackCount).not.toHaveBeenCalled();
    expect(photoSubmissionCount).not.toHaveBeenCalled();
    expect(pairingGroupCount).not.toHaveBeenCalled();
  });
});
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
