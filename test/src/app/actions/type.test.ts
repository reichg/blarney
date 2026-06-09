import { createGroupSchema, updateGroupSchema } from "@/app/actions/type";
import { describe, expect, it } from "vitest";

describe("pairing group schemas (tee time parsing)", () => {
  describe("createGroupSchema", () => {
    it("parses a Pacific wall-clock tee time into the expected UTC instant", () => {
      const result = createGroupSchema.safeParse({
        name: "Group 1",
        sortOrder: "1",
        // 2026-07-01 is PDT (UTC-7): noon Pacific is 19:00 UTC.
        teeTime: "2026-07-01T12:00",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.teeTime).toBeInstanceOf(Date);
        expect(result.data.teeTime?.getTime()).toBe(
          Date.UTC(2026, 6, 1, 19, 0, 0),
        );
      }
    });

    it("parses a winter Pacific wall-clock tee time as PST (UTC-8)", () => {
      const result = createGroupSchema.safeParse({
        name: "Group 1",
        sortOrder: "1",
        teeTime: "2026-01-01T12:00",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.teeTime?.getTime()).toBe(
          Date.UTC(2026, 0, 1, 20, 0, 0),
        );
      }
    });

    it("treats an empty tee time as undefined rather than throwing", () => {
      const result = createGroupSchema.safeParse({
        name: "Group 1",
        sortOrder: "1",
        teeTime: "",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.teeTime).toBeUndefined();
      }
    });

    it("treats an absent tee time as undefined", () => {
      const result = createGroupSchema.safeParse({
        name: "Group 1",
        sortOrder: "1",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.teeTime).toBeUndefined();
      }
    });

    it("reports a validation failure for an unparseable tee time instead of throwing", () => {
      expect(() =>
        createGroupSchema.safeParse({
          name: "Group 1",
          sortOrder: "1",
          teeTime: "nope",
        }),
      ).not.toThrow();

      const result = createGroupSchema.safeParse({
        name: "Group 1",
        sortOrder: "1",
        teeTime: "nope",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((issue) => issue.path.includes("teeTime")),
        ).toBe(true);
      }
    });
  });

  describe("updateGroupSchema", () => {
    it("parses a Pacific wall-clock tee time into the expected UTC instant", () => {
      const result = updateGroupSchema.safeParse({
        id: "group-1",
        name: "Group 1",
        sortOrder: "1",
        teeTime: "2026-07-01T12:00",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.teeTime?.getTime()).toBe(
          Date.UTC(2026, 6, 1, 19, 0, 0),
        );
      }
    });

    it("reports a validation failure for an unparseable tee time instead of throwing", () => {
      const result = updateGroupSchema.safeParse({
        id: "group-1",
        name: "Group 1",
        sortOrder: "1",
        teeTime: "not-a-date",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((issue) => issue.path.includes("teeTime")),
        ).toBe(true);
      }
    });

    it("treats an empty tee time as undefined", () => {
      const result = updateGroupSchema.safeParse({
        id: "group-1",
        name: "Group 1",
        sortOrder: "1",
        teeTime: "",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.teeTime).toBeUndefined();
      }
    });
  });
});
