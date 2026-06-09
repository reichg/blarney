import {
  defaultRegistrationPackageSelection,
  feedbackCategoryOptions,
  feedbackSubmissionSchema,
} from "@/lib/formContracts";
import { describe, expect, it } from "vitest";
import {
  classifyPairingLifecycle,
  computePairingTeeTime,
  createSeededRandom,
  generateFeedback,
  generateGalleryPhoto,
  generatePerson,
  generateRegistration,
  generateRemembrance,
  generateStandaloneRsvp,
  getRegistrationPartyCounts,
  toPairingApplicants,
  type SamplePairingParticipant,
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

describe("toPairingApplicants", () => {
  const buildParticipant = (
    overrides: Partial<SamplePairingParticipant> = {},
  ): SamplePairingParticipant => ({
    id: "participant-1",
    firstName: "Sample",
    lastName: "Golfer",
    gender: "MALE",
    age: 42,
    averageScore: 50,
    ...overrides,
  });

  it("maps every field onto the applicant shape", () => {
    const participant = buildParticipant({
      id: "abc-123",
      firstName: "Jordan",
      lastName: "Rivera",
      gender: "FEMALE",
      age: 27,
      averageScore: 38,
    });

    expect(toPairingApplicants([participant])).toEqual([
      {
        id: "abc-123",
        firstName: "Jordan",
        lastName: "Rivera",
        gender: "FEMALE",
        age: 27,
        averageScore: 38,
      },
    ]);
  });

  it("preserves order and count across the mapping", () => {
    const participants = [
      buildParticipant({ id: "a" }),
      buildParticipant({ id: "b" }),
      buildParticipant({ id: "c" }),
    ];

    const applicants = toPairingApplicants(participants);

    expect(applicants).toHaveLength(3);
    expect(applicants.map((applicant) => applicant.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("returns an empty array for empty input", () => {
    expect(toPairingApplicants([])).toEqual([]);
  });
});

describe("classifyPairingLifecycle", () => {
  it("keeps the only group published when there is a single group", () => {
    expect(classifyPairingLifecycle(1, 1)).toBe("PUBLISHED");
  });

  it("never archives when there are fewer than four groups", () => {
    // totalGroups = 3 -> draftCount = 2, draft threshold = 1.
    expect(classifyPairingLifecycle(1, 3)).toBe("PUBLISHED");
    expect(classifyPairingLifecycle(2, 3)).toBe("DRAFT");
    expect(classifyPairingLifecycle(3, 3)).toBe("DRAFT");
  });

  it("drafts only the trailing group when there are exactly two groups", () => {
    // totalGroups = 2 -> draftCount = 1, draft threshold = 1.
    expect(classifyPairingLifecycle(1, 2)).toBe("PUBLISHED");
    expect(classifyPairingLifecycle(2, 2)).toBe("DRAFT");
  });

  it("archives the first group once the total reaches four", () => {
    // totalGroups = 4 -> draftCount = 2, draft threshold = 2.
    expect(classifyPairingLifecycle(1, 4)).toBe("ARCHIVED");
    expect(classifyPairingLifecycle(2, 4)).toBe("PUBLISHED");
    expect(classifyPairingLifecycle(3, 4)).toBe("DRAFT");
    expect(classifyPairingLifecycle(4, 4)).toBe("DRAFT");
  });

  it("classifies a larger batch as archived, published, then trailing drafts", () => {
    // totalGroups = 5 -> draftCount = 2, draft threshold = 3.
    expect(classifyPairingLifecycle(1, 5)).toBe("ARCHIVED");
    expect(classifyPairingLifecycle(2, 5)).toBe("PUBLISHED");
    expect(classifyPairingLifecycle(3, 5)).toBe("PUBLISHED");
    expect(classifyPairingLifecycle(4, 5)).toBe("DRAFT");
    expect(classifyPairingLifecycle(5, 5)).toBe("DRAFT");
  });

  it("limits drafts to at most the final two groups regardless of total", () => {
    const total = 8;
    const lifecycles = Array.from({ length: total }, (_, index) =>
      classifyPairingLifecycle(index + 1, total),
    );

    expect(lifecycles.filter((value) => value === "DRAFT")).toHaveLength(2);
    expect(lifecycles.filter((value) => value === "ARCHIVED")).toHaveLength(1);
    // Last two sortOrders are the drafts.
    expect(lifecycles[total - 1]).toBe("DRAFT");
    expect(lifecycles[total - 2]).toBe("DRAFT");
  });
});

describe("computePairingTeeTime", () => {
  // baseDate's calendar day drives the result; the time-of-day is overwritten.
  const baseDate = new Date(Date.UTC(2026, 6, 15, 9, 30, 0));

  it("anchors the first published group at 15:00 UTC (8:00am Pacific)", () => {
    const teeTime = computePairingTeeTime(baseDate, 1, "PUBLISHED");

    expect(teeTime.getTime()).toBe(Date.UTC(2026, 6, 15, 15, 0, 0));
  });

  it("staggers each later group by ten minutes", () => {
    const first = computePairingTeeTime(baseDate, 1, "PUBLISHED");
    const fourth = computePairingTeeTime(baseDate, 4, "PUBLISHED");

    expect(fourth.getTime() - first.getTime()).toBe(3 * 10 * 60 * 1000);
    expect(fourth.getTime()).toBe(Date.UTC(2026, 6, 15, 15, 30, 0));
  });

  it("places archived batches one day earlier than the same sort order", () => {
    const published = computePairingTeeTime(baseDate, 1, "PUBLISHED");
    const archived = computePairingTeeTime(baseDate, 1, "ARCHIVED");

    expect(archived.getTime()).toBe(Date.UTC(2026, 6, 14, 15, 0, 0));
    expect(published.getTime() - archived.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("does not mutate the provided baseDate", () => {
    const originalTime = baseDate.getTime();

    computePairingTeeTime(baseDate, 3, "ARCHIVED");

    expect(baseDate.getTime()).toBe(originalTime);
  });

  it("is deterministic for identical inputs", () => {
    const left = computePairingTeeTime(baseDate, 6, "DRAFT");
    const right = computePairingTeeTime(baseDate, 6, "DRAFT");

    expect(left.getTime()).toBe(right.getTime());
  });
});
