import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "pm_inbox_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  return value;
}

function signature(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export type Session = { email: string; expiresAt: number };

export function createSessionToken(email: string): string {
  const payload = Buffer.from(JSON.stringify({ email, expiresAt: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS })).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function verifySessionToken(token: string | undefined): Session | null {
  if (!token) return null;
  const [payload, providedSignature, extra] = token.split(".");
  if (!payload || !providedSignature || extra !== undefined) return null;
  const expected = signature(payload);
  const providedBytes = Buffer.from(providedSignature);
  const expectedBytes = Buffer.from(expected);
  if (providedBytes.length !== expectedBytes.length || !timingSafeEqual(providedBytes, expectedBytes)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Session;
    if (typeof parsed.email !== "string" || typeof parsed.expiresAt !== "number" || parsed.expiresAt <= Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  return verifySessionToken((await cookies()).get(COOKIE_NAME)?.value);
}

export async function setSessionCookie(email: string): Promise<void> {
  (await cookies()).set(COOKIE_NAME, createSessionToken(email), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
