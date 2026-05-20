import {
  buildPairingGroups,
  identifyOlderAnchors,
  isGoodGolfer,
  sortPairingGolfers,
  type PairingApplicant,
} from "@/lib/pairings";
import { describe, expect, it } from "vitest";

function applicant(overrides: Partial<PairingApplicant>): PairingApplicant {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    firstName: overrides.firstName ?? "Test",
    lastName: overrides.lastName ?? "Player",
    gender: overrides.gender ?? "MALE",
    age: overrides.age ?? 40,
    averageScore: overrides.averageScore ?? 45,
  };
}

const balancedApplicants: PairingApplicant[] = [
  applicant({
    id: "fiona",
    firstName: "Fiona",
    lastName: "Hart",
    gender: "FEMALE",
    age: 72,
    averageScore: 44,
  }),
  applicant({
    id: "alice",
    firstName: "Alice",
    lastName: "Lane",
    gender: "FEMALE",
    age: 60,
    averageScore: 38,
  }),
  applicant({
    id: "nora",
    firstName: "Nora",
    lastName: "Quinn",
    gender: "FEMALE",
    age: 68,
    averageScore: 40,
  }),
  applicant({
    id: "paula",
    firstName: "Paula",
    lastName: "Stone",
    gender: "FEMALE",
    age: 65,
    averageScore: 50,
  }),
  applicant({
    id: "mark",
    firstName: "Mark",
    lastName: "Vale",
    gender: "MALE",
    age: 58,
    averageScore: 39,
  }),
  applicant({
    id: "ben",
    firstName: "Ben",
    lastName: "West",
    gender: "MALE",
    age: 54,
    averageScore: 47,
  }),
  applicant({
    id: "chloe",
    firstName: "Chloe",
    lastName: "Young",
    gender: "FEMALE",
    age: 52,
    averageScore: 41,
  }),
  applicant({
    id: "dave",
    firstName: "Dave",
    lastName: "Zane",
    gender: "MALE",
    age: 49,
    averageScore: 53,
  }),
];

const unevenApplicants: PairingApplicant[] = [
  applicant({
    id: "grace",
    firstName: "Grace",
    lastName: "Adams",
    gender: "FEMALE",
    age: 77,
    averageScore: 45,
  }),
  applicant({
    id: "helen",
    firstName: "Helen",
    lastName: "Baird",
    gender: "FEMALE",
    age: 74,
    averageScore: 39,
  }),
  applicant({
    id: "ian",
    firstName: "Ian",
    lastName: "Cole",
    gender: "MALE",
    age: 73,
    averageScore: 43,
  }),
  applicant({
    id: "jade",
    firstName: "Jade",
    lastName: "Dunn",
    gender: "FEMALE",
    age: 62,
    averageScore: 46,
  }),
  applicant({
    id: "kai",
    firstName: "Kai",
    lastName: "East",
    gender: "FEMALE",
    age: 59,
    averageScore: 40,
  }),
  applicant({
    id: "liam",
    firstName: "Liam",
    lastName: "Ford",
    gender: "MALE",
    age: 57,
    averageScore: 38,
  }),
  applicant({
    id: "mona",
    firstName: "Mona",
    lastName: "Gale",
    gender: "FEMALE",
    age: 55,
    averageScore: 50,
  }),
  applicant({
    id: "noah",
    firstName: "Noah",
    lastName: "Hill",
    gender: "MALE",
    age: 53,
    averageScore: 41,
  }),
  applicant({
    id: "owen",
    firstName: "Owen",
    lastName: "Irwin",
    gender: "MALE",
    age: 51,
    averageScore: 52,
  }),
];

const scoreFairnessApplicants: PairingApplicant[] = [
  applicant({
    id: "fiona",
    firstName: "Fiona",
    lastName: "Adams",
    gender: "FEMALE",
    age: 75,
    averageScore: 31,
  }),
  applicant({
    id: "helen",
    firstName: "Helen",
    lastName: "Baird",
    gender: "FEMALE",
    age: 74,
    averageScore: 41,
  }),
  applicant({
    id: "mark",
    firstName: "Mark",
    lastName: "Cole",
    gender: "MALE",
    age: 58,
    averageScore: 36,
  }),
  applicant({
    id: "alice",
    firstName: "Alice",
    lastName: "Dunn",
    gender: "FEMALE",
    age: 57,
    averageScore: 40,
  }),
  applicant({
    id: "ben",
    firstName: "Ben",
    lastName: "East",
    gender: "MALE",
    age: 56,
    averageScore: 46,
  }),
  applicant({
    id: "dave",
    firstName: "Dave",
    lastName: "Ford",
    gender: "MALE",
    age: 55,
    averageScore: 47,
  }),
  applicant({
    id: "carl",
    firstName: "Carl",
    lastName: "Gale",
    gender: "MALE",
    age: 54,
    averageScore: 52,
  }),
  applicant({
    id: "evan",
    firstName: "Evan",
    lastName: "Hill",
    gender: "MALE",
    age: 53,
    averageScore: 53,
  }),
];

describe("pairing builder", () => {
  it("uses 41 and below as the good-golfer threshold", () => {
    expect(isGoodGolfer(41)).toBe(true);
    expect(isGoodGolfer(42)).toBe(false);
  });

  it("sorts the chair pairing golfer list by gender, score, then age", () => {
    const golfers = [
      applicant({
        id: "nora",
        firstName: "Nora",
        lastName: "Neutral",
        gender: "FEMALE",
        age: 48,
        averageScore: 41,
      }),
      applicant({
        id: "beth",
        firstName: "Beth",
        lastName: "Bird",
        gender: "FEMALE",
        age: 60,
        averageScore: 40,
      }),
      applicant({
        id: "uma",
        firstName: "Uma",
        lastName: "Unset",
        gender: "FEMALE",
        age: 75,
        averageScore: 39,
      }),
      applicant({
        id: "mark",
        firstName: "Mark",
        lastName: "Mulligan",
        gender: "MALE",
        age: 54,
        averageScore: 44,
      }),
      applicant({
        id: "cara",
        firstName: "Cara",
        lastName: "Caddie",
        gender: "FEMALE",
        age: 64,
        averageScore: 40,
      }),
      applicant({
        id: "liam",
        firstName: "Liam",
        lastName: "Links",
        gender: "MALE",
        age: 62,
        averageScore: 39,
      }),
    ];

    expect(sortPairingGolfers(golfers).map((golfer) => golfer.id)).toEqual([
      "liam",
      "mark",
      "cara",
      "beth",
      "nora",
      "uma",
    ]);
    expect(golfers.map((golfer) => golfer.id)).toEqual([
      "nora",
      "beth",
      "uma",
      "mark",
      "cara",
      "liam",
    ]);
  });

  it("identifies older anchors from overall age ordering with stable tie-breaking", () => {
    const anchors = identifyOlderAnchors(
      [
        applicant({
          id: "amy",
          firstName: "Amy",
          lastName: "Reed",
          age: 70,
          averageScore: 42,
        }),
        applicant({
          id: "beth",
          firstName: "Beth",
          lastName: "Stone",
          age: 70,
          averageScore: 39,
        }),
        applicant({
          id: "cara",
          firstName: "Cara",
          lastName: "Vale",
          age: 68,
          averageScore: 41,
        }),
        applicant({
          id: "drew",
          firstName: "Drew",
          lastName: "West",
          age: 63,
          averageScore: 36,
        }),
      ],
      3,
    );

    expect(anchors.map((anchor) => anchor.firstName)).toEqual([
      "Beth",
      "Amy",
      "Cara",
    ]);
  });

  it("uses neutral group names and keeps every participant in the output", () => {
    const groups = buildPairingGroups(balancedApplicants);

    expect(groups.map((group) => group.name)).toEqual(["Group 1", "Group 2"]);

    const participantIds = groups.flatMap((group) =>
      group.members.map((member) => member.applicant.id),
    );

    expect(participantIds).toHaveLength(balancedApplicants.length);
    expect([...participantIds].sort()).toEqual(
      balancedApplicants.map((entry) => entry.id).sort(),
    );
    expect(participantIds).toEqual(expect.arrayContaining(["nora", "paula"]));
  });

  it("distributes women, older anchors, and skill levels deterministically", () => {
    const groups = buildPairingGroups(balancedApplicants);
    const olderAnchorIds = new Set(
      identifyOlderAnchors(balancedApplicants, groups.length).map(
        (applicant) => applicant.id,
      ),
    );

    expect(buildPairingGroups(balancedApplicants)).toEqual(groups);
    expect(
      groups.map((group) =>
        group.members.map((member) => member.applicant.firstName),
      ),
    ).toEqual([
      ["Fiona", "Mark", "Chloe", "Paula"],
      ["Nora", "Alice", "Ben", "Dave"],
    ]);
    expect(
      groups.every((group) =>
        group.members.some((member) => member.applicant.gender === "FEMALE"),
      ),
    ).toBe(true);
    expect(
      groups.every((group) =>
        group.members.some((member) => olderAnchorIds.has(member.applicant.id)),
      ),
    ).toBe(true);

    const goodCounts = groups.map(
      (group) => group.members.filter((member) => member.isGoodGolfer).length,
    );
    const badCounts = groups.map(
      (group) => group.members.filter((member) => !member.isGoodGolfer).length,
    );

    expect(goodCounts).toEqual([2, 2]);
    expect(badCounts).toEqual([2, 2]);
  });

  it("keeps uneven rosters balanced without exceeding four players", () => {
    const groups = buildPairingGroups(unevenApplicants);
    const olderAnchorIds = new Set(
      identifyOlderAnchors(unevenApplicants, groups.length).map(
        (applicant) => applicant.id,
      ),
    );

    expect(groups.map((group) => group.members.length)).toEqual([3, 3, 3]);
    expect(groups.every((group) => group.members.length <= 4)).toBe(true);
    expect(
      groups.every((group) =>
        group.members.some((member) => member.applicant.gender === "FEMALE"),
      ),
    ).toBe(true);
    expect(
      groups.every((group) =>
        group.members.some((member) => olderAnchorIds.has(member.applicant.id)),
      ),
    ).toBe(true);
  });

  it("balances projected group averages when bucket counts are otherwise tied", () => {
    const groups = buildPairingGroups(scoreFairnessApplicants);
    const groupAverageScores = groups.map((group) => {
      const totalScore = group.members.reduce(
        (sum, member) => sum + member.applicant.averageScore,
        0,
      );

      return totalScore / group.members.length;
    });

    expect(
      groups.map((group) =>
        group.members.map((member) => member.applicant.firstName),
      ),
    ).toEqual([
      ["Fiona", "Alice", "Ben", "Carl"],
      ["Helen", "Mark", "Dave", "Evan"],
    ]);
    expect(groupAverageScores).toEqual([42.25, 44.25]);
    expect(Math.abs(groupAverageScores[0]! - groupAverageScores[1]!)).toBe(2);
  });
});
