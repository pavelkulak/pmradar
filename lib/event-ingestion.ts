import "server-only";
import { Platform } from "@prisma/client";
import { db } from "@/lib/db";
import type { IncomingMessageEvent } from "@/lib/inbox-domain";

export type { IncomingMessageEvent } from "@/lib/inbox-domain";

export type IngestResult = "accepted" | "duplicate";

export async function recordWebhookReceived(platform: Platform, receivedAt: Date): Promise<void> {
  await db.$executeRaw`
    INSERT INTO "IntegrationStatus" ("platform", "lastWebhookAt", "updatedAt")
    VALUES (${platform}::"Platform", ${receivedAt}, ${receivedAt})
    ON CONFLICT ("platform") DO UPDATE
    SET "lastWebhookAt" = CASE
          WHEN "IntegrationStatus"."lastWebhookAt" IS NULL OR "IntegrationStatus"."lastWebhookAt" < EXCLUDED."lastWebhookAt"
          THEN EXCLUDED."lastWebhookAt" ELSE "IntegrationStatus"."lastWebhookAt" END,
        "updatedAt" = GREATEST("IntegrationStatus"."updatedAt", EXCLUDED."updatedAt")
  `;
}

export async function ingestMessage(event: IncomingMessageEvent): Promise<IngestResult> {
  return db.$transaction(async (tx) => {
    const duplicate = await tx.messageEvent.findUnique({
      where: { platform_platformEventId: { platform: event.platform, platformEventId: event.platformEventId } },
      select: { seq: true },
    });
    if (duplicate) return "duplicate";

    const chat = await tx.chat.upsert({
      where: { platform_externalChatId: { platform: event.platform, externalChatId: event.externalChatId } },
      create: {
        platform: event.platform,
        externalChatId: event.externalChatId,
        externalTitle: event.externalTitle,
        enabled: true,
      },
      update: {},
      select: { id: true },
    });

    // Serialize sequence allocation with acknowledgements and other webhook deliveries
    // for the same chat. Without this lock, seq N+1 could commit before seq N and be
    // acknowledged while N is still invisible to the dashboard.
    await tx.$queryRaw`SELECT "id" FROM "Chat" WHERE "id" = ${chat.id}::uuid FOR UPDATE`;
    const racedDuplicate = await tx.messageEvent.findUnique({
      where: { platform_platformEventId: { platform: event.platform, platformEventId: event.platformEventId } },
      select: { seq: true },
    });
    if (racedDuplicate) return "duplicate";

    const inserted = await tx.messageEvent.createMany({
      data: [{
        chatId: chat.id,
        platform: event.platform,
        platformEventId: event.platformEventId,
        externalMessageId: event.externalMessageId,
        messageAt: event.messageAt,
        receivedAt: event.receivedAt,
      }],
      skipDuplicates: true,
    });
    if (inserted.count === 0) return "duplicate";

    const storedEvent = await tx.messageEvent.findUniqueOrThrow({
      where: { platform_platformEventId: { platform: event.platform, platformEventId: event.platformEventId } },
      select: { seq: true },
    });
    await tx.$executeRaw`
      UPDATE "Chat"
      SET "lastEventSeq" = GREATEST("lastEventSeq", ${storedEvent.seq}),
          "lastMessageAt" = CASE WHEN "lastMessageAt" IS NULL OR "lastMessageAt" < ${event.messageAt} THEN ${event.messageAt} ELSE "lastMessageAt" END,
          "lastWebhookAt" = CASE WHEN "lastWebhookAt" IS NULL OR "lastWebhookAt" < ${event.receivedAt} THEN ${event.receivedAt} ELSE "lastWebhookAt" END,
          "externalTitle" = COALESCE(NULLIF(${event.externalTitle}, ''), "externalTitle"),
          "updatedAt" = GREATEST("updatedAt", ${event.receivedAt})
      WHERE "id" = ${chat.id}::uuid
    `;
    return "accepted";
  });
}

export type TelegramMessage = {
  message_id?: number | string;
  date?: number | string;
  chat?: { id?: number | string; title?: string; type?: string };
  from?: { is_bot?: boolean };
  [key: string]: unknown;
};

const telegramServiceFields = [
  "new_chat_members", "left_chat_member", "new_chat_title", "new_chat_photo", "delete_chat_photo",
  "group_chat_created", "supergroup_chat_created", "channel_chat_created", "migrate_to_chat_id",
  "migrate_from_chat_id", "pinned_message", "video_chat_started", "video_chat_ended",
  "video_chat_participants_invited", "forum_topic_created", "forum_topic_closed", "forum_topic_reopened",
  "general_forum_topic_hidden", "general_forum_topic_unhidden", "write_access_allowed", "users_shared", "chat_shared",
];
const telegramContentFields = [
  "text", "photo", "animation", "audio", "document", "video", "video_note", "voice", "sticker",
  "contact", "dice", "game", "poll", "venue", "location", "invoice", "successful_payment",
  "web_app_data", "story",
];

export function parseTelegramMessage(update: unknown, receivedAt = new Date()): IncomingMessageEvent | null {
  if (!update || typeof update !== "object") return null;
  const value = update as Record<string, unknown>;
  if (!(Number.isSafeInteger(value.update_id) || (typeof value.update_id === "string" && /^\d{1,20}$/.test(value.update_id)))) return null;
  const message = value.message as TelegramMessage | undefined;
  const chat = message?.chat;
  if (!message || !chat || !["group", "supergroup"].includes(String(chat.type))) return null;
  if (message.from?.is_bot) return null;
  if (telegramServiceFields.some((field) => field in message)) return null;
  if (!telegramContentFields.some((field) => field in message)) return null;
  if (message.message_id === undefined || chat.id === undefined) return null;
  const parsedSeconds = Number(message.date);
  const seconds = Number.isFinite(parsedSeconds) && parsedSeconds > 0 ? parsedSeconds : Math.floor(receivedAt.getTime() / 1000);
  return {
    platform: Platform.TELEGRAM,
    externalChatId: String(chat.id),
    externalTitle: typeof chat.title === "string" ? chat.title : null,
    platformEventId: String(value.update_id),
    externalMessageId: String(message.message_id),
    messageAt: new Date(seconds * 1000),
    receivedAt,
  };
}

type JsonRecord = Record<string, unknown>;
const asRecord = (value: unknown): JsonRecord | null => value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
const scalarId = (value: unknown): string | null => typeof value === "string" || typeof value === "number" ? String(value) : null;

export function parseMaxMessage(update: unknown, receivedAt = new Date()): IncomingMessageEvent | null {
  const value = asRecord(update);
  if (!value || value.update_type !== "message_created") return null;
  const message = asRecord(value.message);
  if (!message) return null;
  const sender = asRecord(message.sender);
  if (sender?.is_bot === true) return null;
  const recipient = asRecord(message.recipient);
  if (recipient?.type === "dialog") return null;
  const body = asRecord(message.body);
  const externalMessageId = scalarId(body?.mid ?? message.mid ?? message.message_id);
  const externalChatId = scalarId(recipient?.chat_id ?? message.chat_id ?? value.chat_id);
  if (!externalMessageId || !externalChatId) return null;
  const recipientChat = asRecord(recipient?.chat);
  const updateChat = asRecord(value.chat);
  const title = recipientChat?.title ?? updateChat?.title ?? value.chat_title;
  const timestamp = Number(message.timestamp ?? value.timestamp);
  const messageAt = Number.isFinite(timestamp) && timestamp > 0 ? new Date(timestamp) : receivedAt;
  return {
    platform: Platform.MAX,
    externalChatId,
    externalTitle: typeof title === "string" ? title : null,
    platformEventId: `${externalChatId}:${externalMessageId}`,
    externalMessageId,
    messageAt,
    receivedAt,
  };
}
