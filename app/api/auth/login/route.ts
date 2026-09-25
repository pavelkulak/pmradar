import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/api";
import { setSessionCookie } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return jsonError("Недопустимый источник запроса", 403);
  let body: unknown;
  try { body = await request.json(); } catch { return jsonError("Некорректный запрос", 400); }
  if (!body || typeof body !== "object") return jsonError("Некорректный запрос", 400);
  const { email, password } = body as { email?: unknown; password?: unknown };
  if (typeof email !== "string" || typeof password !== "string" || email.length > 320 || password.length > 1024) return jsonError("Неверный email или пароль", 401);
  const normalizedEmail = email.trim().toLowerCase();
  const user = await db.adminUser.findUnique({ where: { email: normalizedEmail } });
  const configuredEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const hash = user?.passwordHash ?? (normalizedEmail === configuredEmail ? process.env.ADMIN_PASSWORD_HASH : undefined);
  if (!hash || !await bcrypt.compare(password, hash)) return jsonError("Неверный email или пароль", 401);
  await setSessionCookie(user?.email ?? normalizedEmail);
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
