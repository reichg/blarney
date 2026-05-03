import {
  buildPairingGroups,
  isGoodGolfer,
  type PairingApplicant,
} from "@/lib/pairings";
import { describe, expect, it } from "vitest";

const applicants: PairingApplicant[] = [
  {
    id: "1",
    firstName: "Ava",
    lastName: "Reed",
    gender: "FEMALE",
    age: 37,
    averageScore: 39,
  },
  {
    id: "2",
    firstName: "Beth",
    lastName: "Stone",
    gender: "FEMALE",
    age: 62,
    averageScore: 44,
  },
  {
    id: "3",
    firstName: "Cara",
    lastName: "Young",
    gender: "FEMALE",
    age: 51,
    averageScore: 41,
  },
  {
    id: "4",
    firstName: "Dan",
    lastName: "North",
    gender: "MALE",
    age: 45,
    averageScore: 42,
  },
  {
    id: "5",
    firstName: "Eli",
    lastName: "Moore",
    gender: "MALE",
    age: 70,
    averageScore: 40,
  },
  {
    id: "6",
    firstName: "Finn",
    lastName: "Pace",
    gender: "MALE",
    age: 28,
    averageScore: 38,
  },
  {
    id: "7",
    firstName: "Gus",
    lastName: "Vale",
    gender: "MALE",
    age: 64,
    averageScore: 41,
  },
  {
    id: "8",
    firstName: "Hank",
    lastName: "West",
    gender: "MALE",
    age: 35,
    averageScore: 50,
  },
  {
    id: "9",
    firstName: "Ira",
    lastName: "Zane",
    gender: "MALE",
    age: 52,
    averageScore: 46,
  },
];

describe("pairing builder", () => {
  it("uses 41 and below as the good-golfer threshold", () => {
    expect(isGoodGolfer(41)).toBe(true);
    expect(isGoodGolfer(42)).toBe(false);
  });

  it("splits groups by gender and caps each group at four", () => {
    const groups = buildPairingGroups(applicants);

    expect(groups[0].name).toBe("Men Group 1");
    expect(groups[0].members).toHaveLength(4);
    expect(groups[1].name).toBe("Men Group 2");
    expect(groups[1].members).toHaveLength(2);
    expect(groups[2].name).toBe("Women Group 1");
    expect(groups[2].members).toHaveLength(3);
  });

  it("sorts good golfers first, then score, then older age", () => {
    const [mensGroup] = buildPairingGroups(applicants);
    const names = mensGroup.members.map(({ applicant }) => applicant.firstName);

    expect(names).toEqual(["Finn", "Eli", "Gus", "Dan"]);
  });
});
