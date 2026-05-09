import {
  defaultRegistrationPackageSelection,
  feedbackCategoryOptions,
  feedbackSubmissionSchema,
} from "@/lib/formContracts";
import { describe, expect, it } from "vitest";
import {
  createSeededRandom,
  generateFeedback,
  generateGalleryPhoto,
  generatePerson,
  generateRegistration,
  generateRemembrance,
  generateStandaloneRsvp,
  getRegistrationPartyCounts,
} from "../../prisma/sampleDataHelpers";

describe("sampleDataHelpers", () => {
  it("creates deterministic person records", () => {
    const left = generatePerson(createSeededRandom(11), 3);
    const right = generatePerson(createSeededRandom(11), 3);

    expect(left).toEqual(right);
  });

  it("creates deterministic registration records", () => {
    const left = generateRegistration(createSeededRandom(22), 9);
    const right = generateRegistration(createSeededRandom(22), 9);

    expect(left).toEqual(right);
  });

  it("creates deterministic standalone RSVP records", () => {
    const left = generateStandaloneRsvp(createSeededRandom(33), 5);
    const right = generateStandaloneRsvp(createSeededRandom(33), 5);

    expect(left).toEqual(right);
  });

  it("creates deterministic feedback records", () => {
    const left = generateFeedback(createSeededRandom(44), 7);
    const right = generateFeedback(createSeededRandom(44), 7);

    expect(left).toEqual(right);
  });

  it("creates deterministic gallery photo records", () => {
    const left = generateGalleryPhoto(createSeededRandom(55), 4);
    const right = generateGalleryPhoto(createSeededRandom(55), 4);

    expect(left).toEqual(right);
  });

  it("creates deterministic remembrance records", () => {
    const left = generateRemembrance(createSeededRandom(66), 8);
    const right = generateRemembrance(createSeededRandom(66), 8);

    expect(left).toEqual(right);
  });

  it("builds registration RSVP counts that include the golfer", () => {
    expect(getRegistrationPartyCounts(44, 2, 1)).toEqual({
      adultAttendeeCount: 3,
      childAttendeeCount: 1,
    });

    expect(getRegistrationPartyCounts(13, 1, 2)).toEqual({
      adultAttendeeCount: 1,
      childAttendeeCount: 3,
    });
  });

  it("creates example.com emails for safe reruns", () => {
    const registration = generateRegistration(createSeededRandom(77), 0);
    const formRsvp = generateStandaloneRsvp(createSeededRandom(88), 0);
    const feedback = generateFeedback(createSeededRandom(99), 0);
    const remembrance = generateRemembrance(createSeededRandom(111), 0);

    expect(registration.participant.email.endsWith("@example.com")).toBe(true);
    expect(registration.checkout.email.endsWith("@example.com")).toBe(true);
    expect(formRsvp.email.endsWith("@example.com")).toBe(true);
    expect(feedback.email.endsWith("@example.com")).toBe(true);
    expect(remembrance.email.endsWith("@example.com")).toBe(true);
  });

  it("creates approved gallery photos with approved keys", () => {
    const approvedPhoto = Array.from({ length: 10 }, (_, index) =>
      generateGalleryPhoto(createSeededRandom(123 + index), index),
    ).find((photo) => photo.status === "APPROVED");

    expect(approvedPhoto?.approvedS3Key?.startsWith("approved/")).toBe(true);
  });

  it("creates varied remembrance photo counts", () => {
    const rng = createSeededRandom(222);
    const counts = Array.from(
      { length: 15 },
      (_, index) => generateRemembrance(rng, index).photos.length,
    );

    expect(new Set(counts).size).toBeGreaterThan(1);
  });

  it("uses the current golf registration package and required dietary notes", () => {
    const samples = Array.from({ length: 20 }, (_, index) =>
      generateRegistration(createSeededRandom(300 + index), index),
    );

    for (const sample of samples) {
      const dietaryNotes = sample.dietaryNotes;

      expect(sample.packageSelection).toBe(defaultRegistrationPackageSelection);
      expect(dietaryNotes).not.toBeNull();
      expect(dietaryNotes?.trim().length ?? 0).toBeGreaterThan(0);
    }
  });

  it("creates standalone RSVPs that satisfy current required form fields", () => {
    const samples = Array.from({ length: 20 }, (_, index) =>
      generateStandaloneRsvp(createSeededRandom(400 + index), index),
    );

    for (const sample of samples) {
      expect(sample.attendeeCount).toBe(
        sample.adultAttendeeCount + sample.childAttendeeCount,
      );
      expect(sample.attendeeCount).toBeGreaterThan(0);
      expect(sample.attendeeCount).toBeLessThanOrEqual(30);
      expect(sample.familyNames.trim().length).toBeGreaterThan(0);
      expect(sample.dietaryNotes?.trim().length ?? 0).toBeGreaterThan(0);
      expect(sample.notes.trim().length).toBeGreaterThan(0);
    }
  });

  it("creates feedback that matches current form validation and category options", () => {
    const samples = Array.from({ length: 20 }, (_, index) =>
      generateFeedback(createSeededRandom(500 + index), index),
    );

    for (const sample of samples) {
      expect(feedbackCategoryOptions).toContain(sample.category);
      expect(() => feedbackSubmissionSchema.parse(sample)).not.toThrow();
    }
  });

  it("creates gallery photos with the metadata required by the upload form", () => {
    const samples = Array.from({ length: 20 }, (_, index) =>
      generateGalleryPhoto(createSeededRandom(600 + index), index),
    );

    for (const sample of samples) {
      expect(sample.submitterName.trim().length).toBeGreaterThan(0);
      expect(sample.submitterEmail.trim().length).toBeGreaterThan(0);
      expect(sample.caption.trim().length).toBeGreaterThan(0);
    }
  });

  it("includes remembrance contact info whenever sample photos are attached", () => {
    const samples = Array.from({ length: 20 }, (_, index) =>
      generateRemembrance(createSeededRandom(700 + index), index),
    );

    for (const sample of samples) {
      if (sample.photos.length === 0) {
        continue;
      }

      expect(sample.name?.trim().length).toBeGreaterThan(0);
      expect(sample.email.trim().length).toBeGreaterThan(0);

      for (const photo of sample.photos) {
        expect(photo.submitterName).toBe(sample.name);
        expect(photo.submitterEmail).toBe(sample.email);
        expect(photo.caption?.trim().length ?? 0).toBeGreaterThan(0);
      }
    }
  });
});
