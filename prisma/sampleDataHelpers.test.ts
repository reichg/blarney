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
} from "./sampleDataHelpers";

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

  it("creates zero-attendee standalone RSVPs when not attending", () => {
    const samples = Array.from({ length: 20 }, (_, index) =>
      generateStandaloneRsvp(createSeededRandom(300 + index), index),
    );
    const notAttending = samples.find((sample) => !sample.attending);

    expect(notAttending?.attendeeCount).toBe(0);
  });
});
