/**
 * Quick verification script to check sample data counts
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg({
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@localhost:5432/blarney?schema=public",
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const participantCount = await prisma.participant.count({
    where: { email: { contains: "@example.com" } },
  });

  const registrationCount = await prisma.registration.count({
    where: { participant: { email: { contains: "@example.com" } } },
  });

  const rsvpCount = await prisma.rsvp.count({
    where: { email: { contains: "@example.com" } },
  });

  const rsvpRegistrationSource = await prisma.rsvp.count({
    where: {
      email: { contains: "@example.com" },
      source: "REGISTRATION",
    },
  });

  const rsvpFormSource = await prisma.rsvp.count({
    where: {
      email: { contains: "@example.com" },
      source: "FORM",
    },
  });

  const feedbackCount = await prisma.feedback.count({
    where: {
      email: { contains: "@example.com" },
      NOT: { category: "In Remembrance" },
    },
  });

  const remembranceCount = await prisma.feedback.count({
    where: {
      category: "In Remembrance",
      email: { contains: "@example.com" },
    },
  });

  const galleryPhotoCount = await prisma.photoSubmission.count({
    where: {
      submitterEmail: { contains: "@example.com" },
      purpose: "GALLERY",
    },
  });

  const remembrancePhotoCount = await prisma.photoSubmission.count({
    where: {
      submitterEmail: { contains: "@example.com" },
      purpose: "REMEMBRANCE",
    },
  });

  const approvedGalleryPhotos = await prisma.photoSubmission.count({
    where: {
      submitterEmail: { contains: "@example.com" },
      purpose: "GALLERY",
      status: "APPROVED",
      approvedS3Key: { not: null },
    },
  });

  console.log("\n=== Sample Data Verification ===\n");
  console.log(`Participants: ${participantCount}`);
  console.log(`Registrations: ${registrationCount}`);
  console.log(`Total RSVPs: ${rsvpCount}`);
  console.log(`  - From registrations: ${rsvpRegistrationSource}`);
  console.log(`  - Standalone forms: ${rsvpFormSource}`);
  console.log(`General Feedback: ${feedbackCount}`);
  console.log(`Remembrance Entries: ${remembranceCount}`);
  console.log(`Gallery Photos: ${galleryPhotoCount}`);
  console.log(`  - Approved with S3 key: ${approvedGalleryPhotos}`);
  console.log(`Remembrance Photos: ${remembrancePhotoCount}`);
  console.log("");

  // Sample payment status distribution
  const paymentStats = await prisma.registration.groupBy({
    by: ["paymentStatus"],
    where: { participant: { email: { contains: "@example.com" } } },
    _count: true,
  });

  console.log("Payment Status Distribution:");
  paymentStats.forEach((stat) => {
    console.log(`  ${stat.paymentStatus}: ${stat._count}`);
  });
  console.log("");

  // Sample RSVP attendance
  const attendanceStats = await prisma.rsvp.groupBy({
    by: ["attending"],
    where: { email: { contains: "@example.com" } },
    _count: true,
  });

  console.log("RSVP Attendance:");
  attendanceStats.forEach((stat) => {
    console.log(
      `  ${stat.attending ? "Attending" : "Not attending"}: ${stat._count}`,
    );
  });
  console.log("");
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
