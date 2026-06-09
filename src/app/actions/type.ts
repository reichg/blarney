import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { parseEventDateTimeLocal } from "@/lib/eventTime";

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

const optionalTextSchema = z
  .preprocess(
    (value) => (typeof value === "string" ? value.trim() : value),
    z.string().optional().nullable(),
  )
  .transform((value) => (value && value.length > 0 ? value : null));

const requiredIntSchema = (minimum: number, maximum: number) =>
  z.preprocess(
    normalizeRequiredFormValue,
    z.coerce.number().int().min(minimum).max(maximum),
  );

const golferSubmitSchema = z.object({
  firstName: requiredTextSchema,
  lastName: requiredTextSchema,
  gender: z.enum(["MALE", "FEMALE"]),
  age: requiredIntSchema(1, 110),
  averageScore: requiredIntSchema(20, 120),
});

export const registrationSubmitSchema = z
  .object({
    firstName: requiredTextSchema,
    lastName: requiredTextSchema,
    email: z
      .string()
      .trim()
      .email()
      .transform((value) => value.toLowerCase()),
    phone: requiredTextSchema,
    packageSelection: requiredTextSchema,
    golfers: z.array(golferSubmitSchema).min(1).max(20),
    bbqOnlyAdultCount: requiredIntSchema(0, 30),
    bbqOnlyKidCount: requiredIntSchema(0, 30),
    notes: optionalTextSchema,
    dietaryNotes: optionalTextSchema,
  })
  .refine((data) => data.bbqOnlyAdultCount + data.bbqOnlyKidCount <= 30, {
    message: "Keep additional BBQ-only guests at 30 or fewer.",
    path: ["bbqOnlyAdultCount"],
  });

export const rsvpSchema = z
  .object({
    firstName: requiredTextSchema,
    lastName: requiredTextSchema,
    email: z
      .string()
      .trim()
      .email()
      .transform((value) => value.toLowerCase()),
    phone: requiredTextSchema,
    adultAttendeeCount: requiredIntSchema(0, 30),
    childAttendeeCount: requiredIntSchema(0, 30),
    familyNames: optionalTextSchema,
    dietaryNotes: optionalTextSchema,
    notes: optionalTextSchema,
  })
  .refine((data) => data.adultAttendeeCount + data.childAttendeeCount <= 30, {
    message: "Keep the party size at 30 attendees or fewer.",
    path: ["adultAttendeeCount"],
  })
  .refine((data) => data.adultAttendeeCount + data.childAttendeeCount > 0, {
    message: "Add at least one BBQ attendee.",
    path: ["adultAttendeeCount"],
  });

export type SubmitRegistrationResult =
  | {
      ok: true;
      checkoutId: string;
      checkoutUrl: string;
      paymentUrl: string;
      paymentPath: string;
      thanksPath: string;
      registrationId?: string;
      alreadyConfirmed?: boolean;
    }
  | {
      ok: false;
      error: string;
    };

export type SubmitRsvpResult =
  | {
      ok: true;
      requiresPayment?: false;
      thanksPath: string;
      rsvpId?: string;
    }
  | {
      ok: true;
      requiresPayment: true;
      checkoutId: string;
      checkoutUrl: string;
      paymentUrl: string;
      paymentPath: string;
      thanksPath: string;
      rsvpId?: string;
      alreadyConfirmed?: boolean;
    }
  | {
      ok: false;
      reason: "invalid" | "duplicate" | "unavailable";
      error: string;
    };

export type PairingTransaction = Prisma.TransactionClient;

// Chair edits tee times as event-local (Pacific) wall-clock strings; parse them
// into a UTC Date rather than letting z.coerce.date() interpret them in the
// server timezone. Empty/absent values normalize to undefined.
const eventTeeTimeSchema = z.preprocess(
  normalizeRequiredFormValue,
  z
    .string()
    .min(1)
    .transform((value, ctx) => {
      try {
        return parseEventDateTimeLocal(value);
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Invalid tee time",
        });

        return z.NEVER;
      }
    })
    .optional(),
);

export const createGroupSchema = z.object({
  name: z.string().trim().min(1),
  sortOrder: z.coerce.number().int().min(1),
  teeTime: eventTeeTimeSchema,
});

export const updateGroupSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  sortOrder: z.coerce.number().int().min(1),
  teeTime: eventTeeTimeSchema,
});

export const deleteGroupSchema = z.object({
  id: z.string().min(1),
});

export const assignMemberSchema = z.object({
  groupId: z.string().min(1),
  participantId: z.string().min(1),
});

export const removeMemberSchema = z.object({
  memberId: z.string().min(1),
});

export const photoReviewSchema = z.object({
  id: z.preprocess(normalizeRequiredFormValue, z.string().trim().min(1)),
  reviewNotes: z.preprocess(
    normalizeRequiredFormValue,
    z.string().trim().min(1).optional(),
  ),
});

export const photoIdSchema = z.object({
  id: z.preprocess(normalizeRequiredFormValue, z.string().trim().min(1)),
});
