"use server";

import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { z } from "zod";

function normalizeRequiredFormValue(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();

    return trimmed.length > 0 ? trimmed : undefined;
  }

  return value ?? undefined;
}

const requiredTextSchema = z.preprocess(
  normalizeRequiredFormValue,
  z.string().trim().min(1),
);

const requiredIntSchema = (minimum: number, maximum: number) =>
  z.preprocess(
    normalizeRequiredFormValue,
    z.coerce.number().int().min(minimum).max(maximum),
  );

const rsvpSchema = z
  .object({
    firstName: requiredTextSchema,
    lastName: requiredTextSchema,
    email: z
      .string()
      .trim()
      .email()
      .transform((value) => value.toLowerCase()),
    attending: z.preprocess(normalizeRequiredFormValue, z.enum(["yes", "no"])),
    adultAttendeeCount: requiredIntSchema(0, 30),
    childAttendeeCount: requiredIntSchema(0, 30),
    familyNames: requiredTextSchema,
    dietaryNotes: requiredTextSchema,
    notes: requiredTextSchema,
  })
  .refine((data) => data.adultAttendeeCount + data.childAttendeeCount <= 30, {
    message: "Keep the party size at 30 attendees or fewer.",
    path: ["adultAttendeeCount"],
  })
  .superRefine((data, context) => {
    const attendeeCount = data.adultAttendeeCount + data.childAttendeeCount;

    if (data.attending === "yes" && attendeeCount === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Add at least one attendee when attending.",
        path: ["adultAttendeeCount"],
      });
    }

    if (data.attending === "no" && attendeeCount !== 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Set attendee counts to zero when not attending.",
        path: ["adultAttendeeCount"],
      });
    }
  });

export type SubmitRsvpResult =
  | {
      ok: true;
      thanksPath: string;
    }
  | {
      ok: false;
      reason: "invalid" | "duplicate";
      error: string;
    };

const duplicateRsvpMessage =
  "This email already has a registration or RSVP on file.";

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function optionalText(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length ? text : undefined;
}

export async function submitRsvp(
  formData: FormData,
): Promise<SubmitRsvpResult> {
  const parsed = rsvpSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    attending: formData.get("attending"),
    adultAttendeeCount: formData.get("adultAttendeeCount"),
    childAttendeeCount: formData.get("childAttendeeCount"),
    familyNames: formData.get("familyNames"),
    dietaryNotes: formData.get("dietaryNotes"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      reason: "invalid",
      error: "Complete the required RSVP details and try again.",
    };
  }

  const email = parsed.data.email;

  const existingRegistration = await db.registration.findFirst({
    where: {
      participant: {
        email,
      },
    },
    select: { id: true },
  });

  if (existingRegistration) {
    return {
      ok: false,
      reason: "duplicate",
      error: duplicateRsvpMessage,
    };
  }

  const existingRsvp = await db.rsvp.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingRsvp) {
    return {
      ok: false,
      reason: "duplicate",
      error: duplicateRsvpMessage,
    };
  }

  const participant = await db.participant.findUnique({ where: { email } });
  const participantId = participant?.id ?? null;
  const attendeeCount =
    parsed.data.adultAttendeeCount + parsed.data.childAttendeeCount;

  try {
    await db.rsvp.create({
      data: {
        participantId,
        source: "FORM",
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        email,
        attending: parsed.data.attending === "yes",
        adultAttendeeCount: parsed.data.adultAttendeeCount,
        childAttendeeCount: parsed.data.childAttendeeCount,
        attendeeCount,
        familyNames: optionalText(parsed.data.familyNames),
        dietaryNotes: optionalText(parsed.data.dietaryNotes),
        notes: optionalText(parsed.data.notes),
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return {
        ok: false,
        reason: "duplicate",
        error: duplicateRsvpMessage,
      };
    }

    throw error;
  }

  return {
    ok: true,
    thanksPath: "/rsvp/thanks",
  };
}
