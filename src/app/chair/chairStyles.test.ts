import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const chairStyles = readFileSync(
  new URL("./chair.module.css", import.meta.url),
  "utf8",
);

describe("chair card grid styles", () => {
  it("keeps sparse preview rows from stretching cards across the full page", () => {
    const cardGridBlockMatch = chairStyles.match(
      /\.cardGrid\s*\{[^}]*grid-template-columns:\s*repeat\(([^;]+)\);/s,
    );

    expect(cardGridBlockMatch?.[1]).toContain("auto-fill");
  });
});
