import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";

type ChatRow = {
  id: string;
  platform: "TELEGRAM" | "MAX";
  externalChatId: string;
  externalTitle: string | null;
  displayName: string | null;
  openUrl: string | null;
  enabled: boolean;
  latestSeq: string;
  acknowledgedThroughSeq: string;
  unreadCount: string;
  lastMessageAt: Date | null;
  lastWebhookAt: Date | null;
  acknowledgedAt: Date | null;
};

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth) return auth;
  const includeDisabled = request.nextUrl.searchParams.get("includeDisabled") === "1";
  const rows = await db.$queryRaw<ChatRow[]>`
    SELECT c."id"::text AS "id", c."platform"::text AS "platform",
           c."externalChatId", c."externalTitle", c."displayName", c."openUrl", c."enabled",
           c."lastEventSeq"::text AS "latestSeq",
           c."acknowledgedThroughSeq"::text AS "acknowledgedThroughSeq",
           COUNT(e."seq")::text AS "unreadCount",
           c."lastMessageAt", c."lastWebhookAt", c."acknowledgedAt"
    FROM "Chat" c
    LEFT JOIN "MessageEvent" e ON e."chatId" = c."id" AND e."seq" > c."acknowledgedThroughSeq"
    WHERE ${includeDisabled} OR c."enabled" = true
    GROUP BY c."id"
    ORDER BY (COUNT(e."seq") > 0) DESC, c."lastMessageAt" DESC NULLS LAST, c."updatedAt" DESC
  `;
  const chats = rows.map((row) => ({ ...row, unreadCount: Number(row.unreadCount) }));
  return NextResponse.json({ chats, needsAttention: chats.filter((chat) => chat.enabled && chat.unreadCount > 0).length, unreadMessages: chats.filter((chat) => chat.enabled).reduce((sum, chat) => sum + chat.unreadCount, 0) }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth) return auth;
  let body: unknown;
  try { body = await request.json(); } catch { return jsonError("Некорректный запрос", 400); }
  if (!body || typeof body !== "object") return jsonError("Некорректный запрос", 400);
  const data = body as Record<string, unknown>;
  if (typeof data.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.id)) return jsonError("Некорректный ID чата", 400);
  const update: { enabled?: boolean; displayName?: string | null; openUrl?: string | null } = {};
  if ("enabled" in data) {
    if (typeof data.enabled !== "boolean") return jsonError("Некорректное состояние мониторинга", 400);
    update.enabled = data.enabled;
  }
  if ("displayName" in data) {
    if (data.displayName !== null && typeof data.displayName !== "string") return jsonError("Некорректное название", 400);
    const value = typeof data.displayName === "string" ? data.displayName.trim() : "";
    if (value.length > 120) return jsonError("Название должно быть короче 120 символов", 400);
    update.displayName = value || null;
  }
  if ("openUrl" in data) {
    if (data.openUrl !== null && typeof data.openUrl !== "string") return jsonError("Некорректная ссылка", 400);
    const value = typeof data.openUrl === "string" ? data.openUrl.trim() : "";
    if (value.length > 2048) return jsonError("Ссылка слишком длинная", 400);
    if (value) {
      try {
        if (!["https:", "http:", "tg:"].includes(new URL(value).protocol)) return jsonError("Разрешены ссылки http, https и tg", 400);
      } catch { return jsonError("Введите полную ссылку, начинающуюся с https:// или tg://", 400); }
    }
    update.openUrl = value || null;
  }
  if (!Object.keys(update).length) return jsonError("Нет изменений", 400);
  try {
    const chat = await db.chat.update({ where: { id: data.id }, data: update, select: { id: true } });
    return NextResponse.json({ ok: true, id: chat.id });
  } catch {
    return jsonError("Чат не найден", 404);
  }
}
