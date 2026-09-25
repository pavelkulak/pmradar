import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export function isAllowedRequestOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    const expectedOrigin = process.env.APP_URL
      ? new URL(process.env.APP_URL).origin
      : request.nextUrl.origin;
    return new URL(origin).origin === expectedOrigin;
  } catch {
    return false;
  }
}

export async function requireAdmin(request: NextRequest): Promise<NextResponse | null> {
  const session = await getSession();
  if (!session) return jsonError("Требуется авторизация", 401);
  if (!isAllowedRequestOrigin(request)) return jsonError("Недопустимый источник запроса", 403);
  return null;
}

export function safeError(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownError";
}
