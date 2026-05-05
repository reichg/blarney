import { afterEach, describe, expect, it, vi } from "vitest";

const { feedbackCreate } = vi.hoisted(() => ({
  feedbackCreate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    feedback: {
      create: feedbackCreate,
    },
  },
}));

import { POST } from "@/app/api/remembrance/route";

afterEach(() => {
  vi.clearAllMocks();
});

describe("remembrance submission route", () => {
  it("creates a private remembrance feedback row and returns its id", async () => {
    feedbackCreate.mockResolvedValue({ id: "feedback-1" });

    const response = await POST(
      new Request("http://localhost:3000/api/remembrance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "PAT@EXAMPLE.COM",
          message: "Remembering Mike and his laugh.",
          name: " Pat ",
        }),
      }),
    );

    expect(feedbackCreate).toHaveBeenCalledWith({
      data: {
        category: "In Remembrance",
        email: "pat@example.com",
        message: "Remembering Mike and his laugh.",
        name: "Pat",
        rating: null,
      },
      select: { id: true },
    });
    await expect(response.json()).resolves.toEqual({
      feedbackId: "feedback-1",
    });
    expect(response.status).toBe(200);
  });

  it("rejects requests without remembrance text", async () => {
    const response = await POST(
      new Request("http://localhost:3000/api/remembrance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Pat" }),
      }),
    );

    await expect(response.json()).resolves.toEqual({
      message: "Remembrance text is required.",
    });
    expect(response.status).toBe(400);
    expect(feedbackCreate).not.toHaveBeenCalled();
  });
});
