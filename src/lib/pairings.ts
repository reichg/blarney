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

const maxPairingGroupMembers = 4;

type PairingDistributionGroup = {
  sortOrder: number;
  members: PairingApplicant[];
  femaleCount: number;
  goodCount: number;
  badCount: number;
};

const pairingGenderSortOrder: Record<Gender, number> = {
  MALE: 0,
  FEMALE: 1,
  NON_BINARY: 2,
  PREFER_NOT_TO_SAY: 3,
};

type SortablePairingGolfer = Pick<
  PairingApplicant,
  "id" | "firstName" | "lastName" | "gender" | "age" | "averageScore"
>;

export function isGoodGolfer(averageScore: number) {
  return averageScore <= 41;
}

function compareApplicantIdentity(
  left: PairingApplicant,
  right: PairingApplicant,
) {
  if (left.lastName !== right.lastName) {
    return left.lastName.localeCompare(right.lastName);
  }

  if (left.firstName !== right.firstName) {
    return left.firstName.localeCompare(right.firstName);
  }

  return left.id.localeCompare(right.id);
}

function compareApplicantsBySkill(
  left: PairingApplicant,
  right: PairingApplicant,
) {
  if (left.averageScore !== right.averageScore) {
    return left.averageScore - right.averageScore;
  }

  if (left.age !== right.age) {
    return right.age - left.age;
  }

  return compareApplicantIdentity(left, right);
}

function compareApplicantsByPairingListOrder(
  left: SortablePairingGolfer,
  right: SortablePairingGolfer,
) {
  const genderDifference =
    pairingGenderSortOrder[left.gender] - pairingGenderSortOrder[right.gender];

  if (genderDifference !== 0) {
    return genderDifference;
  }

  return compareApplicantsBySkill(left, right);
}

function compareApplicantsByAge(
  left: PairingApplicant,
  right: PairingApplicant,
) {
  if (left.age !== right.age) {
    return right.age - left.age;
  }

  if (left.averageScore !== right.averageScore) {
    return left.averageScore - right.averageScore;
  }

  return compareApplicantIdentity(left, right);
}

export function identifyOlderAnchors(
  applicants: PairingApplicant[],
  groupCount: number,
) {
  return [...applicants]
    .sort(compareApplicantsByAge)
    .slice(0, Math.min(groupCount, applicants.length));
}

export function sortPairingGolfers<T extends SortablePairingGolfer>(
  golfers: T[],
) {
  return [...golfers].sort(compareApplicantsByPairingListOrder);
}

function addApplicantToGroup(
  group: PairingDistributionGroup,
  applicant: PairingApplicant,
) {
  group.members.push(applicant);

  if (applicant.gender === "FEMALE") {
    group.femaleCount += 1;
  }

  if (isGoodGolfer(applicant.averageScore)) {
    group.goodCount += 1;
  } else {
    group.badCount += 1;
  }
}

function projectedGroupAverageScore(
  group: PairingDistributionGroup,
  applicant: PairingApplicant,
) {
  const totalScore = group.members.reduce(
    (sum, member) => sum + member.averageScore,
    applicant.averageScore,
  );

  return totalScore / (group.members.length + 1);
}

function pickTargetGroup(
  groups: PairingDistributionGroup[],
  applicant: PairingApplicant,
  bucket: "good" | "bad",
) {
  return [...groups]
    .filter((group) => group.members.length < maxPairingGroupMembers)
    .sort((left, right) => {
      if (left.members.length !== right.members.length) {
        return left.members.length - right.members.length;
      }

      const leftBucketCount =
        bucket === "good" ? left.goodCount : left.badCount;
      const rightBucketCount =
        bucket === "good" ? right.goodCount : right.badCount;

      if (leftBucketCount !== rightBucketCount) {
        return leftBucketCount - rightBucketCount;
      }

      const leftProjectedAverage = projectedGroupAverageScore(left, applicant);
      const rightProjectedAverage = projectedGroupAverageScore(
        right,
        applicant,
      );

      if (leftProjectedAverage !== rightProjectedAverage) {
        return bucket === "good"
          ? rightProjectedAverage - leftProjectedAverage
          : leftProjectedAverage - rightProjectedAverage;
      }

      return left.sortOrder - right.sortOrder;
    })[0];
}

function groupLabel(index: number) {
  return `Group ${index}`;
}

export function buildPairingGroups(applicants: PairingApplicant[]) {
  if (applicants.length === 0) {
    return [];
  }

  const groupCount = Math.ceil(applicants.length / maxPairingGroupMembers);
  const groups: PairingDistributionGroup[] = Array.from(
    { length: groupCount },
    (_, index) => ({
      sortOrder: index + 1,
      members: [],
      femaleCount: 0,
      goodCount: 0,
      badCount: 0,
    }),
  );
  const availableIds = new Set(applicants.map((applicant) => applicant.id));
  const sortedBySkill = [...applicants].sort(compareApplicantsBySkill);
  const olderAnchors = identifyOlderAnchors(applicants, groupCount);

  for (const [index, applicant] of olderAnchors.entries()) {
    addApplicantToGroup(groups[index]!, applicant);
    availableIds.delete(applicant.id);
  }

  for (const group of groups) {
    if (group.femaleCount > 0) {
      continue;
    }

    const femaleAnchor = sortedBySkill.find(
      (applicant) =>
        availableIds.has(applicant.id) && applicant.gender === "FEMALE",
    );

    if (!femaleAnchor) {
      break;
    }

    addApplicantToGroup(group, femaleAnchor);
    availableIds.delete(femaleAnchor.id);
  }

  for (const bucket of ["good", "bad"] as const) {
    for (const applicant of sortedBySkill) {
      if (!availableIds.has(applicant.id)) {
        continue;
      }

      if (bucket === "good" && !isGoodGolfer(applicant.averageScore)) {
        continue;
      }

      if (bucket === "bad" && isGoodGolfer(applicant.averageScore)) {
        continue;
      }

      const targetGroup = pickTargetGroup(groups, applicant, bucket);

      if (!targetGroup) {
        break;
      }

      addApplicantToGroup(targetGroup, applicant);
      availableIds.delete(applicant.id);
    }
  }

  return groups.map((group) => ({
    name: groupLabel(group.sortOrder),
    sortOrder: group.sortOrder,
    members: group.members.map((applicant, slotIndex) => ({
      applicant,
      slot: slotIndex + 1,
      isGoodGolfer: isGoodGolfer(applicant.averageScore),
    })),
  }));
}
