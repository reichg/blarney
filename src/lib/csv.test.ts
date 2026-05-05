import { describe, expect, it } from "vitest";
import { arrayToCsv, escapeCsvField } from "./csv";

describe("escapeCsvField", () => {
  it("returns empty string for null and undefined", () => {
    expect(escapeCsvField(null)).toBe("");
    expect(escapeCsvField(undefined)).toBe("");
  });

  it("returns string as-is when no special characters", () => {
    expect(escapeCsvField("John Doe")).toBe("John Doe");
    expect(escapeCsvField("123")).toBe("123");
  });

  it("converts numbers to strings", () => {
    expect(escapeCsvField(42)).toBe("42");
    expect(escapeCsvField(0)).toBe("0");
  });

  it("wraps and escapes when field contains comma", () => {
    expect(escapeCsvField("Doe, John")).toBe('"Doe, John"');
  });

  it("wraps and doubles quotes when field contains quotes", () => {
    expect(escapeCsvField('Say "Hello"')).toBe('"Say ""Hello"""');
  });

  it("wraps when field contains newline", () => {
    expect(escapeCsvField("Line 1\nLine 2")).toBe('"Line 1\nLine 2"');
    expect(escapeCsvField("Line 1\r\nLine 2")).toBe('"Line 1\r\nLine 2"');
  });

  it("handles complex field with multiple special characters", () => {
    expect(escapeCsvField('Name: "Doe, John"\nAge: 42')).toBe(
      '"Name: ""Doe, John""\nAge: 42"',
    );
  });
});

describe("arrayToCsv", () => {
  it("converts simple array to CSV", () => {
    const rows = [
      ["Name", "Age"],
      ["John", 30],
      ["Jane", 25],
    ];
    expect(arrayToCsv(rows)).toBe("Name,Age\nJohn,30\nJane,25");
  });

  it("escapes fields with commas", () => {
    const rows = [
      ["Name", "Location"],
      ["John Doe", "San Francisco, CA"],
    ];
    expect(arrayToCsv(rows)).toBe(
      'Name,Location\nJohn Doe,"San Francisco, CA"',
    );
  });

  it("escapes fields with quotes", () => {
    const rows = [
      ["Name", "Quote"],
      ["John", 'He said "Hello"'],
    ];
    expect(arrayToCsv(rows)).toBe('Name,Quote\nJohn,"He said ""Hello"""');
  });

  it("handles null and undefined values", () => {
    const rows = [
      ["Name", "Email", "Phone"],
      ["John", null, undefined],
    ];
    expect(arrayToCsv(rows)).toBe("Name,Email,Phone\nJohn,,");
  });

  it("handles mixed types", () => {
    const rows = [
      ["Name", "Age", "Score", "Active"],
      ["John", 30, 85.5, "Yes"],
    ];
    expect(arrayToCsv(rows)).toBe("Name,Age,Score,Active\nJohn,30,85.5,Yes");
  });
});
