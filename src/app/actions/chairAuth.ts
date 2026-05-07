"use server";

import {
  CHAIR_COOKIE,
  CHAIR_SESSION_MAX_AGE_SECONDS,
  createChairToken,
  isChairPassword,
} from "@/lib/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

function getText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function safeNextPath(value: string) {
  return value.startsWith("/") && !value.startsWith("//") ? value : "/chair";
}

export async function loginChair(formData: FormData) {
  const password = getText(formData.get("password"));
  const nextPath = safeNextPath(getText(formData.get("next")));

  if (!isChairPassword(password)) {
    redirect(`/chair/login?error=1&next=${encodeURIComponent(nextPath)}`);
  }

  const cookieStore = await cookies();
  const token = await createChairToken();

  cookieStore.set(CHAIR_COOKIE, token, {
    httpOnly: true,
    maxAge: CHAIR_SESSION_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  redirect(nextPath);
}

export async function logoutChair() {
  const cookieStore = await cookies();
  cookieStore.delete(CHAIR_COOKIE);
  redirect("/chair/login");
}
