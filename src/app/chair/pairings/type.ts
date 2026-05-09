import type { SearchParamsRecord } from "@/lib/pagination";
import type { Gender, PairingStatus, Participant } from "@prisma/client";

export type PairingGroupWithMembers = {
  id: string;
  name: string;
  teeTime: Date | null;
  sortOrder: number;
  status: PairingStatus;
  members: Array<{
    id: string;
    slot: number;
    snapshotScore: number;
    snapshotAge: number;
    snapshotGender: Gender;
    participant: Participant;
  }>;
};

export type GolferAssignment = {
  groupId: string;
  groupName: string;
} | null;

export type ChairPairingsPageProps = {
  searchParams?: Promise<SearchParamsRecord>;
};

export type PairingNotice = {
  tone: "success" | "error";
  title: string;
  body: string;
};

export type PairingGroupMember = {
  id: string;
  slot: number;
  snapshotScore: number;
  snapshotAge: number;
  participant: {
    firstName: string;
    lastName: string;
  };
};

export type PairingGroupCardProps = {
  group: {
    id: string;
    name: string;
    teeTime: Date | null;
    sortOrder: number;
    status: string;
    members: PairingGroupMember[];
  };
  isDraft: boolean;
};

export type PairingOption = {
  id: string;
  label: string;
  disabled: boolean;
};

export type PairingGolferCardProps = {
  golfer: {
    id: string;
    firstName: string;
    lastName: string;
    age: number;
    gender: string;
    averageScore: number;
    pairingNote: string | null;
    draftAssignment: {
      groupId: string;
      groupName: string;
    } | null;
  };
  groupOptions: PairingOption[];
};
