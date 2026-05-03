"use server";

import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { z } from "zod";

const registrationSchema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  email: z.string().trim().email(),
  phone: z.string().trim().optional(),
  gender: z.enum(["MALE", "FEMALE", "NON_BINARY", "PREFER_NOT_TO_SAY"]),
  age: z.coerce.number().int().min(1).max(110),
  averageScore: z.coerce.number().int().min(20).max(120),
  packageSelection: z.string().trim().min(1),
  guestCount: z.coerce.number().int().min(0).max(20),
  dayBeforeRsvp: z.boolean(),
  notes: z.string().trim().optional(),
});

function optionalText(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length ? text : undefined;
}

export async function submitRegistration(formData: FormData) {
  const parsed = registrationSchema.parse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    phone: optionalText(formData.get("phone")),
    gender: formData.get("gender"),
    age: formData.get("age"),
    averageScore: formData.get("averageScore"),
    packageSelection: formData.get("packageSelection"),
    guestCount: formData.get("guestCount") ?? "0",
    dayBeforeRsvp: formData.get("dayBeforeRsvp") === "on",
    notes: optionalText(formData.get("notes")),
  });

  const email = parsed.email.toLowerCase();

  const participant = await db.participant.upsert({
    where: { email },
    update: {
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      phone: parsed.phone,
      gender: parsed.gender,
      age: parsed.age,
      averageScore: parsed.averageScore,
    },
    create: {
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      email,
      phone: parsed.phone,
      gender: parsed.gender,
      age: parsed.age,
      averageScore: parsed.averageScore,
    },
  });

  await db.registration.create({
    data: {
      participantId: participant.id,
      packageSelection: parsed.packageSelection,
      guestCount: parsed.guestCount,
      dayBeforeRsvp: parsed.dayBeforeRsvp,
      notes: parsed.notes,
    },
  });

  redirect("/register/thanks");
}
