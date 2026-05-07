import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { REMEMBRANCE_FEEDBACK_CATEGORY } from "../src/lib/remembrance";
import {
  createSeededRandom,
  generateFeedback,
  generateGalleryPhoto,
  generateRegistration,
  generateRemembrance,
  generateStandaloneRsvp,
  getRegistrationPartyCounts,
} from "./sampleDataHelpers";
import { seedEventSettings } from "./seedSettings.js";

const adapter = new PrismaPg({
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@localhost:5432/blarney?schema=public",
});

const prisma = new PrismaClient({ adapter });

const sampleSeed = 42;
const registrationCount = 120;
const standaloneRsvpCount = 30;
const feedbackCount = 30;
const galleryPhotoCount = 30;
const remembranceCount = 30;
const sampleDomain = "@example.com";
const baseDate = new Date("2026-05-05T18:00:00.000Z");

function isS3Configured() {
  return Boolean(process.env.AWS_S3_BUCKET);
}

function getS3Client() {
  const region = process.env.AWS_REGION ?? "us-west-1";
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  return new S3Client({
    region,
    requestChecksumCalculation: "WHEN_REQUIRED",
    credentials:
      accessKeyId && secretAccessKey
        ? {
            accessKeyId,
            secretAccessKey,
          }
        : undefined,
  });
}

function sampleDate(index: number, dayWindow: number, minuteStride: number) {
  const value = new Date(baseDate);

  value.setUTCDate(value.getUTCDate() - (index % dayWindow));
  value.setUTCMinutes(value.getUTCMinutes() - index * minuteStride);

  return value;
}

async function uploadPlaceholderImage(key: string) {
  const bucket = process.env.AWS_S3_BUCKET;

  if (!bucket) {
    return;
  }

  const placeholderBase64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  const placeholderBuffer = Buffer.from(placeholderBase64, "base64");

  await getS3Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: placeholderBuffer,
      ContentType: "image/png",
    }),
  );
}

async function clearSampleData() {
  await prisma.photoSubmission.deleteMany({
    where: {
      submitterEmail: {
        contains: sampleDomain,
      },
    },
  });

  await prisma.feedback.deleteMany({
    where: {
      email: {
        contains: sampleDomain,
      },
    },
  });

  await prisma.rsvp.deleteMany({
    where: {
      email: {
        contains: sampleDomain,
      },
    },
  });

  await prisma.registration.deleteMany({
    where: {
      OR: [
        {
          participant: {
            email: {
              contains: sampleDomain,
            },
          },
        },
        {
          checkout: {
            email: {
              contains: sampleDomain,
            },
          },
        },
      ],
    },
  });

  await prisma.registrationCheckout.deleteMany({
    where: {
      email: {
        contains: sampleDomain,
      },
    },
  });

  await prisma.rsvpCheckout.deleteMany({
    where: {
      email: {
        contains: sampleDomain,
      },
    },
  });

  await prisma.participant.deleteMany({
    where: {
      email: {
        contains: sampleDomain,
      },
    },
  });
}

async function seedRegistrations() {
  const rng = createSeededRandom(sampleSeed);

  for (let index = 0; index < registrationCount; index += 1) {
    const registrationData = generateRegistration(rng, index);
    const participantCreatedAt = sampleDate(index, 70, 17);
    const checkoutCreatedAt = sampleDate(index, 65, 13);
    const registrationCreatedAt = sampleDate(index, 60, 11);
    const rsvpCreatedAt = sampleDate(index, 55, 7);

    const participant = await prisma.participant.create({
      data: {
        firstName: registrationData.participant.firstName,
        lastName: registrationData.participant.lastName,
        email: registrationData.participant.email,
        phone: registrationData.participant.phone,
        gender: registrationData.participant.gender,
        age: registrationData.participant.age,
        averageScore: registrationData.participant.averageScore,
        createdAt: participantCreatedAt,
      },
    });

    const checkout = await prisma.registrationCheckout.create({
      data: {
        idempotencyKey: registrationData.checkout.idempotencyKey,
        email: registrationData.checkout.email,
        payload: {
          firstName: registrationData.participant.firstName,
          lastName: registrationData.participant.lastName,
          email: registrationData.checkout.email,
          phone: registrationData.participant.phone,
          packageSelection: registrationData.packageSelection,
          golfers: [
            {
              firstName: registrationData.participant.firstName,
              lastName: registrationData.participant.lastName,
              gender: registrationData.participant.gender,
              age: registrationData.participant.age,
              averageScore: registrationData.participant.averageScore,
            },
          ],
          bbqOnlyAdultCount: registrationData.adultGuestCount,
          bbqOnlyKidCount: registrationData.childGuestCount,
          notes: registrationData.notes,
          dietaryNotes: registrationData.dietaryNotes,
        },
        paymentReference: registrationData.checkout.paymentReference,
        paymentOrderId: registrationData.checkout.paymentOrderId,
        paymentUrl:
          registrationData.checkout.status === "PENDING"
            ? `https://square.example.com/sample/${String(index + 1).padStart(3, "0")}`
            : null,
        status: registrationData.checkout.status,
        confirmedAt:
          registrationData.checkout.status === "CONFIRMED"
            ? checkoutCreatedAt
            : null,
        paymentCompletedAt:
          registrationData.paymentStatus === "CONFIRMED"
            ? checkoutCreatedAt
            : null,
        createdAt: checkoutCreatedAt,
      },
    });

    const registration = await prisma.registration.create({
      data: {
        participantId: participant.id,
        checkoutId: checkout.id,
        packageSelection: registrationData.packageSelection,
        adultGuestCount: registrationData.adultGuestCount,
        childGuestCount: registrationData.childGuestCount,
        paymentStatus: registrationData.paymentStatus,
        paymentReference: registrationData.paymentReference,
        notes: registrationData.notes,
        createdAt: registrationCreatedAt,
      },
    });

    await prisma.registrationCheckout.update({
      where: { id: checkout.id },
      data: {
        registrationId: registration.id,
      },
    });

    if (
      registrationData.paymentStatus === "CONFIRMED" ||
      registrationData.paymentStatus === "WAIVED"
    ) {
      const partyCounts = getRegistrationPartyCounts(
        registrationData.participant.age,
        registrationData.adultGuestCount,
        registrationData.childGuestCount,
      );

      await prisma.rsvp.create({
        data: {
          participantId: participant.id,
          source: "REGISTRATION",
          firstName: registrationData.participant.firstName,
          lastName: registrationData.participant.lastName,
          email: registrationData.participant.email,
          adultAttendeeCount: partyCounts.adultAttendeeCount,
          childAttendeeCount: partyCounts.childAttendeeCount,
          attendeeCount:
            partyCounts.adultAttendeeCount + partyCounts.childAttendeeCount,
          familyNames: `${registrationData.participant.firstName} ${registrationData.participant.lastName}`,
          dietaryNotes: registrationData.dietaryNotes,
          notes: registrationData.notes,
          createdAt: rsvpCreatedAt,
        },
      });
    }
  }
}

async function seedStandaloneRsvps() {
  const rng = createSeededRandom(sampleSeed + 1_000);

  for (let index = 0; index < standaloneRsvpCount; index += 1) {
    const rsvpData = generateStandaloneRsvp(rng, index);

    await prisma.rsvp.create({
      data: {
        source: "FORM",
        firstName: rsvpData.firstName,
        lastName: rsvpData.lastName,
        email: rsvpData.email,
        adultAttendeeCount: rsvpData.adultAttendeeCount,
        childAttendeeCount: rsvpData.childAttendeeCount,
        attendeeCount: rsvpData.attendeeCount,
        familyNames: rsvpData.familyNames,
        dietaryNotes: rsvpData.dietaryNotes,
        notes: rsvpData.notes,
        createdAt: sampleDate(index, 45, 19),
      },
    });
  }
}

async function seedFeedback() {
  const rng = createSeededRandom(sampleSeed + 2_000);
  const feedbackIds: string[] = [];

  for (let index = 0; index < feedbackCount; index += 1) {
    const feedbackData = generateFeedback(rng, index);
    const feedback = await prisma.feedback.create({
      data: {
        name: feedbackData.name,
        email: feedbackData.email,
        rating: feedbackData.rating,
        category: feedbackData.category,
        message: feedbackData.message,
        createdAt: sampleDate(index, 40, 23),
      },
      select: {
        id: true,
      },
    });

    feedbackIds.push(feedback.id);
  }

  return feedbackIds;
}

async function seedGalleryPhotos(feedbackIds: string[]) {
  const rng = createSeededRandom(sampleSeed + 3_000);
  const s3Enabled = isS3Configured();

  if (!s3Enabled) {
    console.log(
      "Skipping S3 placeholder uploads. Gallery and remembrance metadata will still be seeded.",
    );
  }

  for (let index = 0; index < galleryPhotoCount; index += 1) {
    const photoData = generateGalleryPhoto(rng, index);

    if (s3Enabled) {
      await uploadPlaceholderImage(photoData.s3Key);

      if (photoData.approvedS3Key) {
        await uploadPlaceholderImage(photoData.approvedS3Key);
      }
    }

    await prisma.photoSubmission.create({
      data: {
        submitterName: photoData.submitterName,
        submitterEmail: photoData.submitterEmail,
        caption: photoData.caption,
        purpose: "GALLERY",
        feedbackId:
          index < 8 && feedbackIds.length > 0
            ? feedbackIds[index % feedbackIds.length]
            : null,
        s3Key: photoData.s3Key,
        approvedS3Key: photoData.approvedS3Key,
        status: photoData.status,
        reviewNotes: photoData.reviewNotes,
        approvedAt:
          photoData.status === "APPROVED" ? sampleDate(index, 20, 29) : null,
        createdAt: sampleDate(index, 35, 31),
      },
    });
  }
}

async function seedRemembrance() {
  const rng = createSeededRandom(sampleSeed + 4_000);
  const s3Enabled = isS3Configured();

  for (let index = 0; index < remembranceCount; index += 1) {
    const remembranceData = generateRemembrance(rng, index);
    const feedback = await prisma.feedback.create({
      data: {
        name: remembranceData.name,
        email: remembranceData.email,
        rating: null,
        category: REMEMBRANCE_FEEDBACK_CATEGORY,
        message: remembranceData.message,
        createdAt: sampleDate(index, 50, 37),
      },
      select: {
        id: true,
      },
    });

    for (const [photoIndex, photo] of remembranceData.photos.entries()) {
      if (s3Enabled) {
        await uploadPlaceholderImage(photo.s3Key);
      }

      await prisma.photoSubmission.create({
        data: {
          submitterName: photo.submitterName,
          submitterEmail: photo.submitterEmail,
          caption: photo.caption,
          purpose: "REMEMBRANCE",
          feedbackId: feedback.id,
          s3Key: photo.s3Key,
          status: "APPROVED",
          approvedAt: sampleDate(index + photoIndex, 30, 41),
          createdAt: sampleDate(index + photoIndex, 48, 43),
        },
      });
    }
  }
}

async function main() {
  console.log("Seeding Blarney 42 sample data...");

  await seedEventSettings(prisma);
  await clearSampleData();
  await seedRegistrations();
  await seedStandaloneRsvps();
  const feedbackIds = await seedFeedback();
  await seedGalleryPhotos(feedbackIds);
  await seedRemembrance();

  console.log(
    `Sample data complete: ${registrationCount} registrations, ${standaloneRsvpCount} standalone RSVPs, ${feedbackCount} feedback rows, ${galleryPhotoCount} gallery photos, and ${remembranceCount} remembrance entries.`,
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
