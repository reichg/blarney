import {
  EVENT_TIME_ZONE,
  formatEventDateTime,
  parseEventDateTimeLocal,
  toEventDateTimeLocalValue,
} from "@/lib/eventTime";
import { describe, expect, it } from "vitest";

describe("eventTime", () => {
  it("uses the Cannon Beach event timezone", () => {
    expect(EVENT_TIME_ZONE).toBe("America/Los_Angeles");
  });

  describe("formatEventDateTime", () => {
    it("formats a summer instant in event-local time with the PDT abbreviation", () => {
      // 2026-07-01T19:00Z is noon Pacific during daylight saving (UTC-7).
      const summerInstant = new Date(Date.UTC(2026, 6, 1, 19, 0, 0));

      const formatted = formatEventDateTime(summerInstant);

      expect(formatted).toBe("Wed, Jul 1, 12:00 PM PDT");
      expect(formatted).toContain("PDT");
    });

    it("formats a winter instant in event-local time with the PST abbreviation", () => {
      // 2026-01-01T20:00Z is noon Pacific during standard time (UTC-8).
      const winterInstant = new Date(Date.UTC(2026, 0, 1, 20, 0, 0));

      const formatted = formatEventDateTime(winterInstant);

      expect(formatted).toBe("Thu, Jan 1, 12:00 PM PST");
      expect(formatted).toContain("PST");
    });

    it("accepts an ISO string and formats it in event-local time", () => {
      const formatted = formatEventDateTime("2026-07-01T19:00:00.000Z");

      expect(formatted).toBe("Wed, Jul 1, 12:00 PM PDT");
    });

    it("returns TBD for null, undefined, and empty input", () => {
      expect(formatEventDateTime(null)).toBe("TBD");
      expect(formatEventDateTime(undefined)).toBe("TBD");
      expect(formatEventDateTime("")).toBe("TBD");
    });
  });

  describe("parseEventDateTimeLocal", () => {
    it("parses a summer wall-clock string as PDT (UTC-7)", () => {
      const instant = parseEventDateTimeLocal("2026-07-01T12:00");

      expect(instant.getTime()).toBe(Date.UTC(2026, 6, 1, 19, 0, 0));
    });

    it("parses a winter wall-clock string as PST (UTC-8)", () => {
      const instant = parseEventDateTimeLocal("2026-01-01T12:00");

      expect(instant.getTime()).toBe(Date.UTC(2026, 0, 1, 20, 0, 0));
    });

    it("accepts an optional seconds component", () => {
      const instant = parseEventDateTimeLocal("2026-07-01T12:00:30");

      expect(instant.getTime()).toBe(Date.UTC(2026, 6, 1, 19, 0, 30));
    });

    it("throws a RangeError on unparseable input", () => {
      expect(() => parseEventDateTimeLocal("nope")).toThrow(RangeError);
    });
  });

  describe("toEventDateTimeLocalValue", () => {
    it("renders the event-local wall clock for a summer instant", () => {
      const summerInstant = new Date(Date.UTC(2026, 6, 1, 19, 0, 0));

      expect(toEventDateTimeLocalValue(summerInstant)).toBe("2026-07-01T12:00");
    });

    it("renders the event-local wall clock for a winter instant", () => {
      const winterInstant = new Date(Date.UTC(2026, 0, 1, 20, 0, 0));

      expect(toEventDateTimeLocalValue(winterInstant)).toBe("2026-01-01T12:00");
    });

    it("returns an empty string for null and undefined", () => {
      expect(toEventDateTimeLocalValue(null)).toBe("");
      expect(toEventDateTimeLocalValue(undefined)).toBe("");
    });
  });

  describe("round trip", () => {
    it("preserves a summer instant through toEventDateTimeLocalValue and parseEventDateTimeLocal", () => {
      const summerInstant = new Date(Date.UTC(2026, 6, 1, 19, 30, 0));

      const roundTripped = parseEventDateTimeLocal(
        toEventDateTimeLocalValue(summerInstant),
      );

      expect(roundTripped.getTime()).toBe(summerInstant.getTime());
    });

    it("preserves a winter instant through toEventDateTimeLocalValue and parseEventDateTimeLocal", () => {
      const winterInstant = new Date(Date.UTC(2026, 0, 1, 20, 30, 0));

      const roundTripped = parseEventDateTimeLocal(
        toEventDateTimeLocalValue(winterInstant),
      );

      expect(roundTripped.getTime()).toBe(winterInstant.getTime());
    });
  });
});
