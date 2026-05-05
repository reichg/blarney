"use server";

import { CHAIR_COOKIE, verifyChairToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildPairingGroups } from "@/lib/pairings";
import { completeRegistrationPaymentStatuses } from "@/lib/payment";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

function normalizeRequiredFormValue(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();

    return trimmed.length ? trimmed : undefined;
  }

  return value ?? undefined;
}

const pairingGroupSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  sortOrder: z.coerce.number().int().min(1),
  teeTime: z.preprocess(normalizeRequiredFormValue, z.string().trim().min(1)),
});

async function requireChairSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(CHAIR_COOKIE)?.value;
  const isAuthorized = await verifyChairToken(token);

  if (!isAuthorized) {
    redirect("/chair/login");
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

export async function updatePairingGroup(formData: FormData) {
  await requireChairSession();

  const parsed = pairingGroupSchema.parse({
    id: formData.get("id"),
    name: formData.get("name"),
    sortOrder: formData.get("sortOrder"),
    teeTime: formData.get("teeTime"),
  });

  await db.pairingGroup.update({
    where: { id: parsed.id },
    data: {
      name: parsed.name,
      sortOrder: parsed.sortOrder,
      teeTime: new Date(parsed.teeTime),
    },
  });

  revalidatePath("/chair/pairings");
  revalidatePath("/");
}

export async function publishPairings() {
  await requireChairSession();

  await db.$transaction([
    db.pairingGroup.updateMany({
      where: { status: "PUBLISHED" },
      data: { status: "ARCHIVED" },
    }),
    db.pairingGroup.updateMany({
      where: { status: "DRAFT" },
      data: { publishedAt: new Date(), status: "PUBLISHED" },
    }),
  ]);

  revalidatePath("/chair/pairings");
  revalidatePath("/");
}
