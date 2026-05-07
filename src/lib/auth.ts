import { jwtVerify, SignJWT } from "jose";

export const CHAIR_COOKIE = "blarney_chair_session";
export const CHAIR_SESSION_MAX_AGE_SECONDS = 60 * 60 * 2;

const encoder = new TextEncoder();

function getSessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_PASSWORD;

  if (!secret) {
    throw new Error(
      "ADMIN_SESSION_SECRET or ADMIN_PASSWORD must be configured.",
    );
  }

  return encoder.encode(secret);
}

export function isChairPassword(password: string) {
  return (
    Boolean(process.env.ADMIN_PASSWORD) &&
    password === process.env.ADMIN_PASSWORD
  );
}

export async function createChairToken() {
  return new SignJWT({ role: "chair" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${CHAIR_SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSessionSecret());
}

export async function verifyChairToken(token?: string | null) {
  if (!token) {
    return false;
  }

  try {
    const { payload } = await jwtVerify(token, getSessionSecret());
    return payload.role === "chair";
  } catch {
    return false;
  }
}
