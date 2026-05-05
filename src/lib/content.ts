import { db } from "@/lib/db";

export const defaultSettings = {
  eventTitle: "Blarney 42",
  eventDates: "Dates to be announced",
  eventTime: "Tee times to be announced",
  eventLocation: "Cannon Beach, Oregon",
  courseName: "Manzanita Links",
  dayBeforeEventName: "BBQ",
  registrationPackage: "Golf registration with optional BBQ-only guests",
  registrationPriceLabel:
    "Golfer registration with BBQ included, plus separate BBQ-only adult and kid charges handled through Square/Cash",
  logisticsSummary:
    "Weekend details, lodging notes, pairings, and tee times will be kept current here.",
  remembranceUrl: "https://example.com/in-remembrance",
  chairContact: "chair@example.com",
};

export type EventSettings = typeof defaultSettings;

export async function getEventSettings(): Promise<EventSettings> {
  try {
    const rows = await db.eventSetting.findMany();
    const overrides = Object.fromEntries(
      rows.map((row) => [row.key, row.value]),
    );

    return {
      ...defaultSettings,
      ...overrides,
    };
  } catch {
    return defaultSettings;
  }
}
