"use server";

import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { z } from "zod";

const rsvpSchema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  email: z.string().trim().email(),
  attending: z.boolean(),
  attendeeCount: z.coerce.number().int().min(0).max(30),
  familyNames: z.string().trim().optional(),
  dietaryNotes: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

function optionalText(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length ? text : undefined;
}

export async function submitRsvp(formData: FormData) {
  const parsed = rsvpSchema.parse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    attending: formData.get("attending") === "yes",
    attendeeCount: formData.get("attendeeCount") ?? "1",
    familyNames: optionalText(formData.get("familyNames")),
    dietaryNotes: optionalText(formData.get("dietaryNotes")),
    notes: optionalText(formData.get("notes")),
  });

  const email = parsed.email.toLowerCase();
  const participant = await db.participant.findUnique({ where: { email } });

  await db.rsvp.create({
    data: {
      participantId: participant?.id,
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      email,
      attending: parsed.attending,
      attendeeCount: parsed.attendeeCount,
      familyNames: parsed.familyNames,
      dietaryNotes: parsed.dietaryNotes,
      notes: parsed.notes,
    },
  });

  redirect("/rsvp/thanks");
}
