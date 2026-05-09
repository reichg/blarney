import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const { verifyChairToken } = vi.hoisted(() => ({
  verifyChairToken: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  CHAIR_COOKIE: "blarney_chair_session",
  verifyChairToken,
}));

import { middleware } from "../../middleware";

afterEach(() => {
  vi.clearAllMocks();
});

describe("chair middleware", () => {
  it("preserves chair route query params when redirecting to login", async () => {
    verifyChairToken.mockResolvedValue(false);

    const response = await middleware(
      new NextRequest(
        "http://localhost:3000/chair/photos?pendingPage=2&reviewedPage=3",
      ),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/chair/login?next=%2Fchair%2Fphotos%3FpendingPage%3D2%26reviewedPage%3D3",
    );
  });

  it("redirects protected chair api routes to login when the token is invalid", async () => {
    verifyChairToken.mockResolvedValue(false);

    const response = await middleware(
      new NextRequest("http://localhost:3000/api/chair/registrations/export"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/chair/login?next=%2Fapi%2Fchair%2Fregistrations%2Fexport",
    );
  });
});
