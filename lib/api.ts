import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function requireAdmin(request: NextRequest): Promise<NextResponse | null> {
  const session = await getSession();
  if (!session) return jsonError("Требуется авторизация", 401);
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return jsonError("Недопустимый источник запроса", 403);
  return null;
}

export function safeError(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownError";
}
