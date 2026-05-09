import type { CsvField } from "@/lib/type";

export type { CsvField } from "@/lib/type";

export function escapeCsvField(value: CsvField): string {
  if (value === null || value === undefined) {
    return "";
  }

  const str = String(value);

  if (
    str.includes(",") ||
    str.includes('"') ||
    str.includes("\n") ||
    str.includes("\r")
  ) {
    return `"${str.replaceAll('"', '""')}"`;
  }

  return str;
}

export function arrayToCsv(rows: CsvField[][]): string {
  return rows.map((row) => row.map(escapeCsvField).join(",")).join("\n");
}
