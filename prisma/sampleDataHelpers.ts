import type { Gender, PaymentStatus, PhotoStatus } from "@prisma/client";

export type RandomSource = () => number;

export function createSeededRandom(seed: number): RandomSource {
  let state = seed;

  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);

    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rng: RandomSource, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)]!;
}

export function randomInt(rng: RandomSource, min: number, max: number) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const maleFirstNames = [
  "James",
  "Michael",
  "Robert",
  "David",
  "Thomas",
  "Joseph",
  "Daniel",
  "Matthew",
  "Christopher",
  "Andrew",
  "Benjamin",
  "Samuel",
  "Nathan",
  "Oliver",
  "Henry",
] as const;

const femaleFirstNames = [
  "Mary",
  "Patricia",
  "Jennifer",
  "Linda",
  "Elizabeth",
  "Susan",
  "Jessica",
  "Sarah",
  "Emily",
  "Rebecca",
  "Rachel",
  "Lauren",
  "Olivia",
  "Avery",
  "Sophia",
] as const;

const lastNames = [
  "Smith",
  "Johnson",
  "Williams",
  "Brown",
  "Jones",
  "Garcia",
  "Miller",
  "Davis",
  "Rodriguez",
  "Martinez",
  "Lee",
  "Walker",
  "Young",
  "Allen",
  "King",
  "Wright",
  "Scott",
  "Torres",
  "Hill",
  "Green",
  "Baker",
  "Rivera",
  "Campbell",
  "Mitchell",
  "Carter",
] as const;

const longLastNames = [
  "Vanderberg-Williams",
  "Montgomery-Blackwell",
  "Harrington-Sutherland",
] as const;

const packageSelections = [
  "Golf + BBQ",
  "Golf only",
  "Golf + BBQ with family",
] as const;

const feedbackCategories = [
  "Event",
  "Website",
  "Logistics",
  "Payment",
  "General",
] as const;

const feedbackMessages = [
  "Wonderful event. The weekend felt organized, warm, and easy to navigate from the first tee time through the final meal.",
  "The logistics notes were helpful and the chair communication stayed clear the whole time.",
  "The golf groups were balanced and fun. We met people we probably would not have played with otherwise.",
  "The payment flow worked, but the confirmation wording could be clearer for guests who are only coming to the BBQ.",
  "Thank you for keeping the event welcoming for longtime players and first-time families alike.",
] as const;

const photoCaptions = [
  "First tee smiles above the morning fog.",
  "The foursome that claimed the loudest cheers of the day.",
  "Ocean light, wind off the dunes, and a perfect look at the green.",
  "Post-round BBQ plates disappearing at record speed.",
  "Sunset over Cannon Beach after the final putt.",
] as const;

const remembranceMessages = [
  "In loving memory of a Blarney regular whose stories, laughter, and impossible chip shots still shape how this weekend feels. We miss the easy warmth they brought to every table and every tee box.",
  "Remembering a parent, sibling, and friend whose kindness made newcomers feel at home right away. Their voice still echoes in every shared meal and every walk back to the clubhouse.",
  "Honoring someone who taught us to love the game, but more importantly to love the people around it. Their generosity remains one of the quiet foundations of this event.",
] as const;

function chooseGender(index: number, rng: RandomSource): Gender {

  return rng() > 0.5 ? "MALE" : "FEMALE";
}

function buildLongRegistrationNote(index: number) {
  return `Sample registration note ${index + 1}: bringing extra family, may arrive after lunch, and would appreciate being seated near longtime friends if possible. This intentionally runs long so the chair tables get a real wrapping case during local development.`;
}

function buildLongDietaryNote(index: number) {
  return `Sample dietary note ${index + 1}: gluten-free preferred, avoids shellfish, and needs clear ingredient labeling because one guest has a severe tree nut allergy and another guest is dairy-sensitive.`;
}

function buildLongFeedbackMessage(index: number) {
  return `Sample feedback ${index + 1}: the event was terrific overall, but this message is intentionally long so the chair feedback table has a realistic wrapping case with multiple sentences, extra context, and enough detail to expose overflow or cramped column behavior on narrow screens.`;
}

function buildLongPhotoCaption(index: number) {
  return `Sample gallery caption ${index + 1}: a deliberately long caption describing the light, the course, the people, and the mood so the chair photo review tables and public gallery can be checked against longer text without needing manual entry first.`;
}

function buildLongFamilyNames(index: number) {
  return `The Montgomery-Blackwell family plus cousins and the ${index + 1}th extended guest cluster`;
}

function buildLongRemembranceMessage(index: number) {
  return `Sample remembrance ${index + 1}: this longer note remembers a beloved Blarney presence whose generosity, jokes, and quiet encouragement made the weekend feel like home. It is intentionally written at a length that helps test previews, wrapping, and private remembrance layout behavior.`;
}

export interface PersonData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gender: Gender;
  age: number;
  averageScore: number;
}

export interface RegistrationData {
  participant: PersonData;
  packageSelection: string;
  adultGuestCount: number;
  childGuestCount: number;
  paymentStatus: PaymentStatus;
  paymentReference: string | null;
  notes: string | null;
  dietaryNotes: string | null;
  checkout: {
    email: string;
    idempotencyKey: string;
    paymentOrderId: string | null;
    paymentReference: string | null;
    status: "PENDING" | "CONFIRMED";
  };
}

export interface RsvpData {
  firstName: string;
  lastName: string;
  email: string;
  attending: boolean;
  adultAttendeeCount: number;
  childAttendeeCount: number;
  attendeeCount: number;
  familyNames: string | null;
  dietaryNotes: string | null;
  notes: string | null;
}

export interface FeedbackData {
  name: string | null;
  email: string;
  rating: number | null;
  category: string;
  message: string;
}

export interface PhotoData {
  submitterName: string;
  submitterEmail: string;
  caption: string | null;
  status: PhotoStatus;
  s3Key: string;
  approvedS3Key: string | null;
  reviewNotes: string | null;
}

export interface RemembranceData {
  name: string | null;
  email: string;
  message: string;
  photos: Array<{
    submitterName: string;
    submitterEmail: string;
    caption: string | null;
    s3Key: string;
  }>;
}

export function getRegistrationPartyCounts(
  golferAge: number,
  adultGuestCount: number,
  childGuestCount: number,
) {
  const golferIsChild = golferAge < 15;

  return {
    adultAttendeeCount: adultGuestCount + (golferIsChild ? 0 : 1),
    childAttendeeCount: childGuestCount + (golferIsChild ? 1 : 0),
  };
}

export function generatePerson(
  rng: RandomSource,
  index: number,
  overrideGender?: Gender,
): PersonData {
  const gender = overrideGender ?? chooseGender(index, rng);
  const firstNamePool = gender === "MALE" ? maleFirstNames : femaleFirstNames;
  const firstName = pick(rng, firstNamePool);
  const lastName =
    index % 19 === 0 ? pick(rng, longLastNames) : pick(rng, lastNames);
  const age =
    index % 15 === 0 ? randomInt(rng, 12, 14) : randomInt(rng, 18, 78);
  const averageScore =
    index % 5 < 2 ? randomInt(rng, 34, 41) : randomInt(rng, 42, 63);
  const slug = `${slugify(firstName)}-${slugify(lastName)}-${String(index + 1).padStart(3, "0")}`;

  return {
    firstName,
    lastName,
    email: `${slug}@example.com`,
    phone: `503-555-${String(index + 1).padStart(4, "0")}`,
    gender,
    age,
    averageScore,
  };
}

export function generateRegistration(
  rng: RandomSource,
  index: number,
): RegistrationData {
  const participant = generatePerson(rng, index);
  const paymentStatus =
    index % 10 < 6
      ? "CONFIRMED"
      : index % 10 < 8
        ? "WAIVED"
        : "EXTERNAL_PENDING";
  const adultGuestCount = index % 8 === 0 ? 0 : randomInt(rng, 0, 3);
  const childGuestCount =
    index % 6 === 0 ? randomInt(rng, 1, 2) : randomInt(rng, 0, 1);
  const sampleId = String(index + 1).padStart(3, "0");
  const notes =
    index % 9 === 0
      ? buildLongRegistrationNote(index)
      : index % 3 === 0
        ? `Sample registration note ${index + 1}.`
        : null;
  const dietaryNotes =
    index % 11 === 0
      ? buildLongDietaryNote(index)
      : index % 4 === 0
        ? pick(rng, ["Vegetarian", "Gluten-free", "Dairy-free"] as const)
        : null;

  return {
    participant,
    packageSelection: pick(rng, packageSelections),
    adultGuestCount,
    childGuestCount,
    paymentStatus,
    paymentReference:
      paymentStatus === "EXTERNAL_PENDING"
        ? null
        : `sample-reg-ref-${sampleId}`,
    notes,
    dietaryNotes,
    checkout: {
      email: participant.email,
      idempotencyKey: `sample-registration-checkout-${sampleId}`,
      paymentOrderId:
        paymentStatus === "EXTERNAL_PENDING"
          ? null
          : `sample-order-${sampleId}`,
      paymentReference:
        paymentStatus === "EXTERNAL_PENDING"
          ? null
          : `sample-reg-ref-${sampleId}`,
      status: paymentStatus === "EXTERNAL_PENDING" ? "PENDING" : "CONFIRMED",
    },
  };
}

export function generateStandaloneRsvp(
  rng: RandomSource,
  index: number,
): RsvpData {
  const firstName = pick(
    rng,
    index % 2 === 0 ? femaleFirstNames : maleFirstNames,
  );
  const lastName =
    index % 7 === 0 ? pick(rng, longLastNames) : pick(rng, lastNames);
  const slug = `${slugify(firstName)}-${slugify(lastName)}-${String(index + 1).padStart(3, "0")}`;
  const attending = index % 6 !== 0;
  const adultAttendeeCount = attending ? randomInt(rng, 0, 4) : 0;
  const childAttendeeCount =
    attending && index % 4 === 0 ? randomInt(rng, 0, 2) : 0;

  return {
    firstName,
    lastName,
    email: `rsvp-${slug}@example.com`,
    attending,
    adultAttendeeCount,
    childAttendeeCount,
    attendeeCount: attending ? adultAttendeeCount + childAttendeeCount : 0,
    familyNames:
      index % 5 === 0
        ? buildLongFamilyNames(index)
        : adultAttendeeCount + childAttendeeCount > 1
          ? `${firstName} ${lastName} household`
          : null,
    dietaryNotes:
      index % 8 === 0
        ? buildLongDietaryNote(index)
        : index % 3 === 0
          ? pick(rng, ["Vegetarian", "Nut allergy", "Gluten-free"] as const)
          : null,
    notes:
      index % 10 === 0
        ? buildLongRegistrationNote(index)
        : index % 4 === 0
          ? `Sample RSVP note ${index + 1}.`
          : null,
  };
}

export function generateFeedback(
  rng: RandomSource,
  index: number,
): FeedbackData {
  const firstName = pick(
    rng,
    index % 2 === 0 ? femaleFirstNames : maleFirstNames,
  );
  const lastName = pick(rng, lastNames);
  const slug = `${slugify(firstName)}-${slugify(lastName)}-${String(index + 1).padStart(3, "0")}`;

  return {
    name: index % 6 === 0 ? null : `${firstName} ${lastName}`,
    email: `feedback-${slug}@example.com`,
    rating: index % 5 === 0 ? null : randomInt(rng, 2, 5),
    category: feedbackCategories[index % feedbackCategories.length],
    message:
      index % 6 === 0
        ? buildLongFeedbackMessage(index)
        : pick(rng, feedbackMessages),
  };
}

export function generateGalleryPhoto(
  rng: RandomSource,
  index: number,
): PhotoData {
  const firstName = pick(
    rng,
    index % 2 === 0 ? femaleFirstNames : maleFirstNames,
  );
  const lastName = pick(rng, lastNames);
  const sampleId = String(index + 1).padStart(3, "0");
  const status =
    index % 5 < 3 ? "APPROVED" : index % 5 === 3 ? "PENDING" : "REJECTED";

  return {
    submitterName: `${firstName} ${lastName}`,
    submitterEmail: `photo-${slugify(firstName)}-${slugify(lastName)}-${sampleId}@example.com`,
    caption:
      index % 7 === 0
        ? buildLongPhotoCaption(index)
        : index % 3 === 0
          ? pick(rng, photoCaptions)
          : null,
    status,
    s3Key: `pending/sample-gallery-${sampleId}.png`,
    approvedS3Key:
      status === "APPROVED" ? `approved/sample-gallery-${sampleId}.png` : null,
    reviewNotes:
      status === "PENDING"
        ? null
        : status === "APPROVED"
          ? `Approved sample gallery photo ${sampleId}.`
          : `Rejected sample gallery photo ${sampleId} for local moderation testing.`,
  };
}

export function generateRemembrance(
  rng: RandomSource,
  index: number,
): RemembranceData {
  const firstName = pick(
    rng,
    index % 2 === 0 ? femaleFirstNames : maleFirstNames,
  );
  const lastName =
    index % 8 === 0 ? pick(rng, longLastNames) : pick(rng, lastNames);
  const sampleId = String(index + 1).padStart(3, "0");
  const photoCount = index % 5 === 0 ? 0 : index % 6 === 0 ? 2 : 1;

  return {
    name: index % 4 === 0 ? null : `${firstName} ${lastName}`,
    email: `remembrance-${slugify(firstName)}-${slugify(lastName)}-${sampleId}@example.com`,
    message:
      index % 4 === 0
        ? buildLongRemembranceMessage(index)
        : pick(rng, remembranceMessages),
    photos: Array.from({ length: photoCount }, (_, photoIndex) => ({
      submitterName: `${firstName} ${lastName}`,
      submitterEmail: `remembrance-photo-${slugify(firstName)}-${slugify(lastName)}-${sampleId}-${photoIndex + 1}@example.com`,
      caption:
        photoIndex === 0 && index % 7 === 0
          ? `Sample remembrance caption ${sampleId} with enough detail to test preview wrapping.`
          : `Remembrance photo ${photoIndex + 1}`,
      s3Key: `remembrance/sample-remembrance-${sampleId}-${String(photoIndex + 1).padStart(2, "0")}.png`,
    })),
  };
}
