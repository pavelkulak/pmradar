import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/session";
import { jsonError, requireAdmin } from "@/lib/api";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth) return auth;
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
