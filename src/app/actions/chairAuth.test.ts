import { loginChair } from "@/app/actions/chairAuth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createChairToken, isChairPassword, cookies, redirect } = vi.hoisted(
  () => ({
    createChairToken: vi.fn(),
    isChairPassword: vi.fn(),
    cookies: vi.fn(),
    redirect: vi.fn((path: string) => {
      throw new Error(`REDIRECT:${path}`);
    }),
  }),
);

vi.mock("@/lib/auth", () => ({
  CHAIR_COOKIE: "blarney_chair_session",
  CHAIR_SESSION_MAX_AGE_SECONDS: 60 * 60 * 2,
  createChairToken,
  isChairPassword,
}));

vi.mock("next/headers", () => ({
  cookies,
}));

vi.mock("next/navigation", () => ({
  redirect,
}));

describe("chair auth actions", () => {
  const cookieStore = {
    delete: vi.fn(),
    set: vi.fn(),
  };

  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "test");
    cookies.mockResolvedValue(cookieStore);
    createChairToken.mockResolvedValue("chair-token");
    isChairPassword.mockReturnValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("sets a two-hour session cookie after a successful chair login", async () => {
    const formData = new FormData();
    formData.set("password", "chair-password");
    formData.set("next", "/chair/photos");

    await expect(loginChair(formData)).rejects.toThrow(
      "REDIRECT:/chair/photos",
    );

    expect(cookieStore.set).toHaveBeenCalledWith(
      "blarney_chair_session",
      "chair-token",
      {
        httpOnly: true,
        maxAge: 60 * 60 * 2,
        path: "/",
        sameSite: "lax",
        secure: false,
      },
    );
  });

  it("does not set a cookie when the password is invalid", async () => {
    const formData = new FormData();
    formData.set("password", "wrong-password");
    formData.set("next", "/chair/photos?pendingPage=2");
    isChairPassword.mockReturnValue(false);

    await expect(loginChair(formData)).rejects.toThrow(
      "REDIRECT:/chair/login?error=1&next=%2Fchair%2Fphotos%3FpendingPage%3D2",
    );

    expect(createChairToken).not.toHaveBeenCalled();
    expect(cookieStore.set).not.toHaveBeenCalled();
  });
});
