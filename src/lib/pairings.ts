import type { Gender } from "@prisma/client";

export type PairingApplicant = {
  id: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  age: number;
  averageScore: number;
};

export type PairingGroupResult = {
  name: string;
  sortOrder: number;
  members: Array<{
    applicant: PairingApplicant;
    slot: number;
    isGoodGolfer: boolean;
  }>;
};

const genderOrder: Gender[] = [
  "MALE",
  "FEMALE",
  "NON_BINARY",
  "PREFER_NOT_TO_SAY",
];

export function isGoodGolfer(averageScore: number) {
  return averageScore <= 41;
}

function compareApplicants(left: PairingApplicant, right: PairingApplicant) {
  const leftGood = isGoodGolfer(left.averageScore) ? 0 : 1;
  const rightGood = isGoodGolfer(right.averageScore) ? 0 : 1;

  if (leftGood !== rightGood) {
    return leftGood - rightGood;
  }

  if (left.averageScore !== right.averageScore) {
    return left.averageScore - right.averageScore;
  }

  if (left.age !== right.age) {
    return right.age - left.age;
  }

  return `${left.lastName} ${left.firstName}`.localeCompare(
    `${right.lastName} ${right.firstName}`,
  );
}

function groupLabel(gender: Gender, index: number) {
  const label =
    gender === "MALE"
      ? "Men"
      : gender === "FEMALE"
        ? "Women"
        : gender === "NON_BINARY"
          ? "Open"
          : "Unspecified";

  return `${label} Group ${index}`;
}

export function buildPairingGroups(applicants: PairingApplicant[]) {
  const results: PairingGroupResult[] = [];

  for (const gender of genderOrder) {
    const sortedApplicants = applicants
      .filter((applicant) => applicant.gender === gender)
      .sort(compareApplicants);

    for (let index = 0; index < sortedApplicants.length; index += 4) {
      const groupMembers = sortedApplicants.slice(index, index + 4);
      const groupNumber = Math.floor(index / 4) + 1;

      results.push({
        name: groupLabel(gender, groupNumber),
        sortOrder: results.length + 1,
        members: groupMembers.map((applicant, slotIndex) => ({
          applicant,
          slot: slotIndex + 1,
          isGoodGolfer: isGoodGolfer(applicant.averageScore),
        })),
      });
    }
  }

  return results;
}
