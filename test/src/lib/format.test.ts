import { formatBbqGuestSummary } from "@/lib/format";
import { describe, expect, it } from "vitest";

describe("formatBbqGuestSummary", () => {
  it("renders adult and kid BBQ counts on separate lines", () => {
    expect(formatBbqGuestSummary(3, 1)).toBe("BBQ adults: 3\nBBQ kids: 1");
  });

  it("renders the zero case without collapsing to an empty label", () => {
    expect(formatBbqGuestSummary(0, 0)).toBe("BBQ adults: 0\nBBQ kids: 0");
  });
});
