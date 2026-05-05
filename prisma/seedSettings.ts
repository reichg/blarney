import type { PrismaClient } from "@prisma/client";

export const eventSettings = {
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
} as const;

type EventSettingClient = Pick<PrismaClient, "eventSetting">;

export async function seedEventSettings(prisma: EventSettingClient) {
  await Promise.all(
    Object.entries(eventSettings).map(([key, value]) =>
      prisma.eventSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      }),
    ),
  );
}
