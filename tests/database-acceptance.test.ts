import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { PrismaClient, Platform } from "@prisma/client";
import { db } from "@/lib/db";
import { acknowledgeChatThrough, unreadCountForChat } from "@/lib/acknowledgement";
import { ingestMessage, type IncomingMessageEvent } from "@/lib/event-ingestion";
import { POST as telegramWebhook } from "@/app/webhooks/telegram/route";

const enabled = process.env.RUN_DB_INTEGRATION === "1" && Boolean(process.env.DATABASE_URL);
const suite = enabled ? describe : describe.skip;
const externalChatIds = new Set<string>();

function event(chatExternalId: string, id: string): IncomingMessageEvent {
  return {
    platform: Platform.TELEGRAM,
    externalChatId: chatExternalId,
    externalTitle: "Acceptance test chat",
    platformEventId: `${chatExternalId}:${id}`,
    externalMessageId: id,
    messageAt: new Date(),
    receivedAt: new Date(),
  };
}

function newChat() {
  const externalChatId = `acceptance-${randomUUID()}`;
  externalChatIds.add(externalChatId);
  return externalChatId;
}

async function chatId(externalChatId: string) {
  const chat = await db.chat.findUniqueOrThrow({ where: { platform_externalChatId: { platform: Platform.TELEGRAM, externalChatId } }, select: { id: true } });
  return chat.id;
}

suite("database-backed acceptance flow (set RUN_DB_INTEGRATION=1)", () => {
  it("A — one delivered message creates one unread database event", async () => {
    const externalId = newChat();
    await ingestMessage(event(externalId, "one-message"));
    expect(await unreadCountForChat(await chatId(externalId))).toBe(1);
  });

  it("B — five delivered messages count as five unread events", async () => {
    const externalId = newChat();
    for (let index = 0; index < 5; index++) await ingestMessage(event(externalId, `five-${index}`));
    expect(await unreadCountForChat(await chatId(externalId))).toBe(5);
  });

  it("C — duplicate webhook delivery inserts only one unread event", async () => {
    const chat = newChat();
    const delivery = event(chat, "duplicate-1");
    expect(await ingestMessage(delivery)).toBe("accepted");
    expect(await ingestMessage(delivery)).toBe("duplicate");
    expect(await unreadCountForChat(await chatId(chat))).toBe(1);
  });

  it("D — acknowledges all events through the displayed latest sequence", async () => {
    const externalId = newChat();
    for (let i = 0; i < 5; i++) await ingestMessage(event(externalId, `ack-${i}`));
    const id = await chatId(externalId);
    const chat = await db.chat.findUniqueOrThrow({ where: { id }, select: { lastEventSeq: true } });
    expect(await acknowledgeChatThrough(id, chat.lastEventSeq)).toBe(chat.lastEventSeq.toString());
    expect(await unreadCountForChat(id)).toBe(0);
  });

  it("E — a concurrent new event survives acknowledgement of the previously displayed sequence", async () => {
    const externalId = newChat();
    await ingestMessage(event(externalId, "race-before"));
    const id = await chatId(externalId);
    const displayed = await db.chat.findUniqueOrThrow({ where: { id }, select: { lastEventSeq: true } });
    await ingestMessage(event(externalId, "race-during"));
    await acknowledgeChatThrough(id, displayed.lastEventSeq);
    expect(await unreadCountForChat(id)).toBe(1);
  });

  it("F — a message after acknowledgement becomes unread again", async () => {
    const externalId = newChat();
    await ingestMessage(event(externalId, "after-ack-before"));
    const id = await chatId(externalId);
    const current = await db.chat.findUniqueOrThrow({ where: { id }, select: { lastEventSeq: true } });
    await acknowledgeChatThrough(id, current.lastEventSeq);
    await ingestMessage(event(externalId, "after-ack-next"));
    expect(await unreadCountForChat(id)).toBe(1);
  });

  it("G — acknowledgement state remains stored when the database client reconnects", async () => {
    const externalId = newChat();
    await ingestMessage(event(externalId, "restart-1"));
    const id = await chatId(externalId);
    const current = await db.chat.findUniqueOrThrow({ where: { id }, select: { lastEventSeq: true } });
    await acknowledgeChatThrough(id, current.lastEventSeq);
    const reconnect = new PrismaClient();
    try {
      const persisted = await reconnect.chat.findUniqueOrThrow({ where: { id }, select: { acknowledgedThroughSeq: true } });
      expect(persisted.acknowledgedThroughSeq).toBe(current.lastEventSeq);
    } finally { await reconnect.$disconnect(); }
  });

  it("I — no text, caption, attachment or raw request columns exist on MessageEvent", async () => {
    const columns = await db.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'MessageEvent'
    `;
    const names = columns.map((column) => column.column_name);
    expect(names).not.toContain("text");
    expect(names).not.toContain("caption");
    expect(names).not.toContain("attachments");
    expect(names).not.toContain("rawPayload");
  });

  it("H — a bad Telegram secret is rejected before any database rows are written", async () => {
    const externalId = newChat();
    const previousSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    process.env.TELEGRAM_WEBHOOK_SECRET = "expected-test-secret";
    try {
      const request = new NextRequest("http://localhost/webhooks/telegram", {
        method: "POST",
        headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": "bad-test-secret" },
        body: JSON.stringify({ update_id: 999, message: { message_id: 1, text: "must not be stored", chat: { id: externalId, type: "group" } } }),
      });
      const response = await telegramWebhook(request);
      expect(response.status).toBe(401);
      expect(await db.chat.findUnique({ where: { platform_externalChatId: { platform: Platform.TELEGRAM, externalChatId: externalId } } })).toBeNull();
      expect(await db.integrationStatus.findUnique({ where: { platform: Platform.TELEGRAM } })).toBeNull();
    } finally {
      if (previousSecret === undefined) delete process.env.TELEGRAM_WEBHOOK_SECRET;
      else process.env.TELEGRAM_WEBHOOK_SECRET = previousSecret;
    }
  });

  afterAll(async () => {
    if (externalChatIds.size) await db.chat.deleteMany({ where: { externalChatId: { in: [...externalChatIds] } } });
  });
});
