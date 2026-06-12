import { buildReturnTo } from "@/app/chair/notices/returnTo";
import { describe, expect, it } from "vitest";

describe("buildReturnTo", () => {
  it("serializes string params into a same-page relative URL", () => {
    expect(
      buildReturnTo("/chair/photos", { tab: "gallery", page: "2" }),
    ).toBe("/chair/photos?tab=gallery&page=2");
  });

  it("appends array params in order", () => {
    expect(
      buildReturnTo("/chair/photos", { status: ["pending", "approved"] }),
    ).toBe("/chair/photos?status=pending&status=approved");
  });

  it("skips undefined values", () => {
    expect(
      buildReturnTo("/chair/photos", { tab: "gallery", page: undefined }),
    ).toBe("/chair/photos?tab=gallery");
  });

  it("returns the bare base path when no params serialize", () => {
    expect(buildReturnTo("/chair/photos", {})).toBe("/chair/photos");
    expect(buildReturnTo("/chair/photos", { page: undefined })).toBe(
      "/chair/photos",
    );
  });
});
