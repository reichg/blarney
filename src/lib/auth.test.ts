import {
  CHAIR_SESSION_MAX_AGE_SECONDS,
  createChairToken,
  verifyChairToken,
} from "@/lib/auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const issuedAt = new Date("2026-05-06T10:00:00Z");

describe("chair auth", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(issuedAt);
    vi.stubEnv("ADMIN_SESSION_SECRET", "chair-session-secret");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("expires chair tokens after two hours", async () => {
    const token = await createChairToken();

    await expect(verifyChairToken(token)).resolves.toBe(true);

    vi.setSystemTime(
      new Date(issuedAt.getTime() + (CHAIR_SESSION_MAX_AGE_SECONDS - 1) * 1000),
    );

    await expect(verifyChairToken(token)).resolves.toBe(true);

    vi.setSystemTime(
      new Date(issuedAt.getTime() + (CHAIR_SESSION_MAX_AGE_SECONDS + 1) * 1000),
    );

    await expect(verifyChairToken(token)).resolves.toBe(false);
  });
});
