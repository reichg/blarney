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

  it.each([
    {
      description: "the message is missing",
      body: { email: "pat@example.com", name: "Pat" },
    },
    {
      description: "the name is missing",
      body: { email: "pat@example.com", message: "Remembering Mike." },
    },
    {
      description: "the email is missing",
      body: { message: "Remembering Mike.", name: "Pat" },
    },
  ])("rejects requests when $description", async ({ body }) => {
    const response = await POST(
      new Request("http://localhost:3000/api/remembrance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }),
    );

    await expect(response.json()).resolves.toEqual({
      message:
        "Complete the remembrance message, name, and email before sending.",
    });
    expect(response.status).toBe(400);
    expect(feedbackCreate).not.toHaveBeenCalled();
  });
});
