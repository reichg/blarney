import { feedbackSubmissionSchema } from "@/lib/formContracts";
import { describe, expect, it } from "vitest";

describe("feedbackSubmissionSchema", () => {
  it("accepts a trimmed category from the public feedback options", () => {
    expect(
      feedbackSubmissionSchema.parse({
        name: "Pat Guest",
        email: "pat@example.com",
        rating: "5",
        category: " Photos ",
        message: "Great gallery updates.",
      }),
    ).toMatchObject({
      category: "Photos",
      rating: 5,
    });
  });

  it("rejects categories outside the public feedback options", () => {
    expect(() =>
      feedbackSubmissionSchema.parse({
        name: "Pat Guest",
        email: "pat@example.com",
        rating: "4",
        category: "Payment",
        message: "Square link worked fine.",
      }),
    ).toThrow();
  });
});
