import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAdmin } from "@/lib/api";
import { acknowledgeChatThrough } from "@/lib/acknowledgement";

export const dynamic = "force-dynamic";
const MAX_BIGINT = 9_223_372_036_854_775_807n;

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (auth) return auth;
  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return jsonError("Чат не найден", 404);
  let body: unknown;
  try { body = await request.json(); } catch { return jsonError("Некорректный запрос", 400); }
  const throughSeqValue = body && typeof body === "object" ? (body as { throughSeq?: unknown }).throughSeq : undefined;
  if (typeof throughSeqValue !== "string" || !/^\d{1,19}$/.test(throughSeqValue)) return jsonError("throughSeq должен быть строкой с номером события", 400);
  const throughSeq = BigInt(throughSeqValue);
  if (throughSeq > MAX_BIGINT) return jsonError("Номер события вне допустимого диапазона", 400);

  const acknowledgedThroughSeq = await acknowledgeChatThrough(id, throughSeq);
  if (acknowledgedThroughSeq === null) return jsonError("Чат не найден", 404);
  return NextResponse.json({ ok: true, acknowledgedThroughSeq }, { headers: { "Cache-Control": "no-store" } });
}
