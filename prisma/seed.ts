import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg({
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@localhost:5432/blarney?schema=public",
});

const prisma = new PrismaClient({ adapter });

const settings = {
  eventTitle: "Blarney 42",
  eventDates: "Dates to be announced",
  eventTime: "Tee times to be announced",
  eventLocation: "Cannon Beach, Oregon",
  courseName: "Manzanita Links",
  dayBeforeEventName: "Day-before gathering",
  registrationPackage: "Golf registration with optional pre-event guests",
  registrationPriceLabel:
    "Golfer registration plus separate adult and child pre-event guest charges handled through Square/Cash",
  logisticsSummary:
    "Weekend details, lodging notes, pairings, and tee times will be kept current here.",
  remembranceUrl: "https://example.com/in-remembrance",
  chairContact: "chair@example.com",
};

async function main() {
  await Promise.all(
    Object.entries(settings).map(([key, value]) =>
      prisma.eventSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      }),
    ),
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
