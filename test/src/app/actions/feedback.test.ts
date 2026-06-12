import { submitFeedback } from "@/app/actions/feedback";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";

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

function buildFeedbackFormData(
  overrides: Partial<Record<string, string>> = {},
) {
  const formData = new FormData();
  const fields: Record<string, string> = {
    name: "Pat Golfer",
    email: "pat@example.com",
    rating: "4",
    category: "Logistics",
    message: "The shuttle timing worked great.",
    ...overrides,
  };

  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }

  return formData;
}

let consoleErrorSpy: MockInstance;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
  vi.clearAllMocks();
});

describe("submitFeedback", () => {
  it("persists a valid submission and returns the thanks redirect", async () => {
    feedbackCreate.mockResolvedValue({ id: "feedback-1" });

    await expect(submitFeedback(buildFeedbackFormData())).resolves.toEqual({
      redirectTo: "/feedback/thanks",
    });

    expect(feedbackCreate).toHaveBeenCalledWith({
      data: {
        name: "Pat Golfer",
        email: "pat@example.com",
        rating: 4,
        category: "Logistics",
        message: "The shuttle timing worked great.",
      },
    });
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("returns the submit-failed notice redirect when validation rejects the input", async () => {
    await expect(
      submitFeedback(buildFeedbackFormData({ email: "not-an-email" })),
    ).resolves.toEqual({
      redirectTo: "/feedback?feedback=submit-failed",
    });

    expect(feedbackCreate).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "feedback submission failed",
      expect.anything(),
    );
  });

  it("returns the submit-failed notice redirect instead of throwing when the database write fails", async () => {
    feedbackCreate.mockRejectedValueOnce(new Error("db unavailable"));

    // Resolving (never rejecting) is the contract: the client hook turns the
    // notice code into an error toast while the visitor stays on the form.
    await expect(submitFeedback(buildFeedbackFormData())).resolves.toEqual({
      redirectTo: "/feedback?feedback=submit-failed",
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "feedback submission failed",
      expect.anything(),
    );
  });
});
