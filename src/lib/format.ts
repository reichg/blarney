import { formatEventDateTime } from "@/lib/eventTime";

export function formatDateTime(value: Date | string | null | undefined) {
  return formatEventDateTime(value);
}

export function formatCurrency(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export function formatBbqGuestSummary(adultCount: number, childCount: number) {
  return `BBQ adults: ${adultCount}\nBBQ kids: ${childCount}`;
}

export function initials(firstName: string, lastName: string) {
  return `${firstName.slice(0, 1)}${lastName.slice(0, 1)}`.toUpperCase();
}
