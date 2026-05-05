"use server";

import { CHAIR_COOKIE, verifyChairToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildPairingGroups } from "@/lib/pairings";
import { completeRegistrationPaymentStatuses } from "@/lib/payment";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

const maxPairingGroupMembers = 4;

type PairingTransaction = Prisma.TransactionClient;

function normalizeRequiredFormValue(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();

    return trimmed.length ? trimmed : undefined;
  }

  return value ?? undefined;
}

const createGroupSchema = z.object({
  name: z.string().trim().min(1),
  sortOrder: z.coerce.number().int().min(1),
  teeTime: z.preprocess(normalizeRequiredFormValue, z.coerce.date().optional()),
});

const updateGroupSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  sortOrder: z.coerce.number().int().min(1),
  teeTime: z.preprocess(normalizeRequiredFormValue, z.coerce.date().optional()),
});

const deleteGroupSchema = z.object({
  id: z.string().min(1),
});

const assignMemberSchema = z.object({
  groupId: z.string().min(1),
  participantId: z.string().min(1),
});

const removeMemberSchema = z.object({
  memberId: z.string().min(1),
});

async function requireChairSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(CHAIR_COOKIE)?.value;
  const isAuthorized = await verifyChairToken(token);

  if (!isAuthorized) {
    redirect("/chair/login");
  }
}

async function compactGroupSlots(
  transaction: PairingTransaction,
  groupId: string,
) {
  const remainingMembers = await transaction.pairingMember.findMany({
    where: { groupId },
    orderBy: [{ slot: "asc" }, { id: "asc" }],
  });

  for (const [index, member] of remainingMembers.entries()) {
    const nextSlot = index + 1;

    if (member.slot !== nextSlot) {
      await transaction.pairingMember.update({
        where: { id: member.id },
        data: { slot: nextSlot },
      });
    }
  }
}

export async function generatePairings() {
  await requireChairSession();

  const participants = await db.participant.findMany({
    where: {
      registrations: {
        some: {
          paymentStatus: {
            in: [...completeRegistrationPaymentStatuses],
          },
        },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const groups = buildPairingGroups(participants);

  await db.$transaction(async (transaction) => {
    const drafts = await transaction.pairingGroup.findMany({
      select: { id: true },
      where: { status: "DRAFT" },
    });
    const draftIds = drafts.map((draft) => draft.id);

    if (draftIds.length) {
      await transaction.pairingMember.deleteMany({
        where: { groupId: { in: draftIds } },
      });
      await transaction.pairingGroup.deleteMany({
        where: { id: { in: draftIds } },
      });
    }

    for (const group of groups) {
      await transaction.pairingGroup.create({
        data: {
          name: group.name,
          sortOrder: group.sortOrder,
          status: "DRAFT",
          members: {
            create: group.members.map((member) => ({
              participantId: member.applicant.id,
              slot: member.slot,
              snapshotAge: member.applicant.age,
              snapshotGender: member.applicant.gender,
              snapshotScore: member.applicant.averageScore,
            })),
          },
        },
      });
    }
  });

  revalidatePath("/chair/pairings");
}

export async function createPairingGroup(formData: FormData) {
  await requireChairSession();

  const parsed = createGroupSchema.parse({
    name: formData.get("name"),
    sortOrder: formData.get("sortOrder"),
    teeTime: formData.get("teeTime"),
  });

  await db.pairingGroup.create({
    data: {
      name: parsed.name,
      sortOrder: parsed.sortOrder,
      status: "DRAFT",
      teeTime: parsed.teeTime ?? null,
    },
  });

  revalidatePath("/chair/pairings");
}

export async function deletePairingGroup(formData: FormData) {
  await requireChairSession();

  const parsed = deleteGroupSchema.parse({
    id: formData.get("id"),
  });

  await db.pairingGroup.delete({
    where: { id: parsed.id, status: "DRAFT" },
  });

  revalidatePath("/chair/pairings");
}

export async function updatePairingGroup(formData: FormData) {
  await requireChairSession();

  const parsed = updateGroupSchema.parse({
    id: formData.get("id"),
    name: formData.get("name"),
    sortOrder: formData.get("sortOrder"),
    teeTime: formData.get("teeTime"),
  });

  await db.pairingGroup.update({
    where: { id: parsed.id, status: "DRAFT" },
    data: {
      name: parsed.name,
      sortOrder: parsed.sortOrder,
      teeTime: parsed.teeTime ?? null,
    },
  });

  revalidatePath("/chair/pairings");
  revalidatePath("/");
}

export async function assignPairingMember(formData: FormData) {
  await requireChairSession();

  const parsed = assignMemberSchema.parse({
    groupId: formData.get("groupId"),
    participantId: formData.get("participantId"),
  });

  await db.$transaction(async (transaction) => {
    const targetGroup = await transaction.pairingGroup.findUnique({
      where: { id: parsed.groupId },
      include: {
        members: {
          select: { id: true, participantId: true, slot: true },
          orderBy: [{ slot: "asc" }, { id: "asc" }],
        },
      },
    });

    if (!targetGroup) {
      throw new Error("Group not found");
    }

    if (targetGroup.status !== "DRAFT") {
      throw new Error("Can only assign members to draft groups");
    }

    const existingDraftMemberships = await transaction.pairingMember.findMany({
      where: {
        participantId: parsed.participantId,
        group: { status: "DRAFT" },
      },
      select: { id: true, groupId: true },
    });
    const isAlreadyInTargetGroup = existingDraftMemberships.some(
      (membership) => membership.groupId === parsed.groupId,
    );

    if (
      targetGroup.members.length >= maxPairingGroupMembers &&
      !isAlreadyInTargetGroup
    ) {
      throw new Error("Group is full (max 4 members)");
    }

    const membershipsToMove = existingDraftMemberships.filter(
      (membership) => membership.groupId !== parsed.groupId,
    );

    if (membershipsToMove.length) {
      await transaction.pairingMember.deleteMany({
        where: {
          id: { in: membershipsToMove.map((membership) => membership.id) },
        },
      });

      const sourceGroupIds = [
        ...new Set(membershipsToMove.map((membership) => membership.groupId)),
      ];

      for (const groupId of sourceGroupIds) {
        await compactGroupSlots(transaction, groupId);
      }
    }

    if (isAlreadyInTargetGroup) {
      return;
    }

    const participant = await transaction.participant.findUnique({
      where: { id: parsed.participantId },
      select: { id: true, age: true, gender: true, averageScore: true },
    });

    if (!participant) {
      throw new Error("Participant not found");
    }

    const nextSlot = targetGroup.members.length + 1;

    await transaction.pairingMember.create({
      data: {
        groupId: parsed.groupId,
        participantId: parsed.participantId,
        slot: nextSlot,
        snapshotAge: participant.age,
        snapshotGender: participant.gender,
        snapshotScore: participant.averageScore,
      },
    });
  });

  revalidatePath("/chair/pairings");
}

export async function removePairingMember(formData: FormData) {
  await requireChairSession();

  const parsed = removeMemberSchema.parse({
    memberId: formData.get("memberId"),
  });

  await db.$transaction(async (transaction) => {
    const member = await transaction.pairingMember.findUnique({
      where: { id: parsed.memberId },
      include: {
        group: { select: { id: true, status: true } },
      },
    });

    if (!member) {
      throw new Error("Member not found");
    }

    if (member.group.status !== "DRAFT") {
      throw new Error("Can only remove members from draft groups");
    }

    await transaction.pairingMember.delete({
      where: { id: parsed.memberId },
    });

    await compactGroupSlots(transaction, member.groupId);
  });

  revalidatePath("/chair/pairings");
}

export async function unpublishPairings() {
  await requireChairSession();

  await db.$transaction(async (transaction) => {
    const draftGroups = await transaction.pairingGroup.findMany({
      where: { status: "DRAFT" },
      select: { id: true },
    });

    if (draftGroups.length > 0) {
      throw new Error(
        "Cannot unpublish published pairings while draft pairings already exist",
      );
    }

    const publishedGroups = await transaction.pairingGroup.findMany({
      where: { status: "PUBLISHED" },
      select: { id: true },
    });

    if (publishedGroups.length === 0) {
      return;
    }

    await transaction.pairingGroup.updateMany({
      where: { status: "PUBLISHED" },
      data: { publishedAt: null, status: "DRAFT" },
    });
  });

  revalidatePath("/chair/pairings");
  revalidatePath("/");
}

export async function publishPairings() {
  await requireChairSession();

  await db.$transaction(async (transaction) => {
    const publishedAt = new Date();
    const promotedDrafts = await transaction.pairingGroup.updateMany({
      where: { status: "DRAFT" },
      data: { publishedAt, status: "PUBLISHED" },
    });

    if (promotedDrafts.count === 0) {
      return;
    }

    await transaction.pairingGroup.updateMany({
      where: {
        status: "PUBLISHED",
        OR: [{ publishedAt: null }, { publishedAt: { lt: publishedAt } }],
      },
      data: { status: "ARCHIVED" },
    });
  });

  revalidatePath("/chair/pairings");
  revalidatePath("/");
}
