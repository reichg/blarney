import "server-only";

import { CHAIR_COOKIE, verifyChairToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";

function buildChairLoginPath(nextPath: string) {
  return `/chair/login?next=${encodeURIComponent(nextPath)}`;
}

export async function requireChairPageAuth(nextPath: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get(CHAIR_COOKIE)?.value;
  const isAuthorized = await verifyChairToken(token);

  if (!isAuthorized) {
    redirect(buildChairLoginPath(nextPath));
  }
}

export async function requireChairApiAuth(request: NextRequest) {
  const token = request.cookies.get(CHAIR_COOKIE)?.value;
  const isAuthorized = await verifyChairToken(token);

  if (isAuthorized) {
    return null;
  }

  return NextResponse.json(
    { message: "Unauthorized." },
    {
      status: 401,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
