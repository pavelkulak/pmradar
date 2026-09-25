import "server-only";
import { db } from "@/lib/db";

export async function acknowledgeChatThrough(chatId: string, requested: bigint): Promise<string | null> {
  const result = await db.$queryRaw<Array<{ id: string; acknowledgedThroughSeq: string }>>`
    UPDATE "Chat"
    SET "acknowledgedThroughSeq" = GREATEST("acknowledgedThroughSeq", LEAST(${requested}::bigint, "lastEventSeq")),
        "acknowledgedAt" = NOW(),
        "updatedAt" = NOW()
    WHERE "id" = ${chatId}::uuid
    RETURNING "id"::text AS "id", "acknowledgedThroughSeq"::text AS "acknowledgedThroughSeq"
  `;
  return result[0]?.acknowledgedThroughSeq ?? null;
}

export async function unreadCountForChat(chatId: string): Promise<number> {
  const result = await db.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS "count"
    FROM "MessageEvent" e
    JOIN "Chat" c ON c."id" = e."chatId"
    WHERE c."id" = ${chatId}::uuid AND e."seq" > c."acknowledgedThroughSeq"
  `;
  return Number(result[0]?.count ?? 0n);
}
