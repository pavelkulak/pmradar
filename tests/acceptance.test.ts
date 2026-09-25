import { describe, expect, it } from "vitest";
import { Prisma, Platform } from "@prisma/client";
import JSONbig from "json-bigint";
import { countUnread, nextAcknowledgedSequence } from "@/lib/inbox-domain";
import { parseMaxMessage, parseTelegramMessage } from "@/lib/event-ingestion";
import { isWebhookSecretValid } from "@/lib/webhook-auth";

describe("message event acceptance rules", () => {
  it("A — one new message becomes one unread event", () => {
    expect(countUnread([101n], 100n)).toBe(1);
  });

  it("B — five new messages produce an unread count of five", () => {
    expect(countUnread([101n, 102n, 103n, 104n, 105n], 100n)).toBe(5);
  });

  it("D — acknowledging the latest sequence clears those events", () => {
    const acknowledged = nextAcknowledgedSequence(95n, 100n, 100n);
    expect(countUnread([96n, 97n, 98n, 99n, 100n], acknowledged)).toBe(0);
  });

  it("E — a message arriving during acknowledgement remains unread", () => {
    const displayedLatest = 100n;
    const databaseLatestWhenAcknowledged = 101n;
    const acknowledged = nextAcknowledgedSequence(80n, displayedLatest, databaseLatestWhenAcknowledged);
    expect(acknowledged).toBe(100n);
    expect(countUnread([101n], acknowledged)).toBe(1);
  });

  it("never moves an acknowledgement backwards or above the stored latest sequence", () => {
    expect(nextAcknowledgedSequence(100n, 90n, 105n)).toBe(100n);
    expect(nextAcknowledgedSequence(0n, 999n, 105n)).toBe(105n);
  });

  it("F — a new event after acknowledgement is unread", () => {
    expect(countUnread([200n], 199n)).toBe(1);
  });

  it("rejects a bad webhook secret", () => {
    expect(isWebhookSecretValid("expected-secret", "wrong-secret")).toBe(false);
    expect(isWebhookSecretValid("expected-secret", null)).toBe(false);
    expect(isWebhookSecretValid(undefined, "expected-secret")).toBe(false);
    expect(isWebhookSecretValid("expected-secret", "expected-secret")).toBe(true);
  });

  it("does not store message content in the Prisma event model", () => {
    const model = Prisma.dmmf.datamodel.models.find((item) => item.name === "MessageEvent");
    expect(model).toBeDefined();
    const fields = model!.fields.map((field) => field.name);
    expect(fields).not.toContain("text");
    expect(fields).not.toContain("caption");
    expect(fields).not.toContain("rawPayload");
    expect(fields).not.toContain("senderName");
  });

  it("accepts an ordinary Telegram group message without retaining its text", () => {
    const event = parseTelegramMessage({
      update_id: 77,
      message: { message_id: 5, date: 1_750_000_000, text: "private customer text", from: { id: 12, is_bot: false }, chat: { id: -123, title: "Client group", type: "supergroup" } },
    }, new Date("2026-09-25T12:00:00.000Z"));
    expect(event).toMatchObject({ platform: Platform.TELEGRAM, externalChatId: "-123", externalTitle: "Client group", platformEventId: "77", externalMessageId: "5" });
    expect(event).not.toHaveProperty("text");
  });

  it("ignores Telegram edits, service messages, bot messages and private chats", () => {
    const base = { message_id: 5, date: 1_750_000_000, text: "hello", chat: { id: -123, title: "Group", type: "group" } };
    expect(parseTelegramMessage({ update_id: 1, edited_message: base })).toBeNull();
    expect(parseTelegramMessage({ update_id: 2, message: { ...base, new_chat_members: [{ id: 42 }] } })).toBeNull();
    expect(parseTelegramMessage({ update_id: 3, message: { ...base, from: { is_bot: true } } })).toBeNull();
    expect(parseTelegramMessage({ update_id: 4, message: { ...base, chat: { id: 1, type: "private" } } })).toBeNull();
  });

  it("accepts MAX message_created by body.mid and ignores edits", () => {
    const event = parseMaxMessage({
      update_type: "message_created", timestamp: 1_750_000_000_000, chat_id: 442,
      message: { timestamp: 1_750_000_000_000, recipient: { chat_id: 442, type: "chat" }, body: { mid: "mid_abc", text: "private customer text" } },
    });
    expect(event).toMatchObject({ platform: Platform.MAX, externalChatId: "442", externalMessageId: "mid_abc", platformEventId: "442:mid_abc" });
    expect(event).not.toHaveProperty("text");
    expect(parseMaxMessage({ update_type: "message_edited", chat_id: 442, message: { body: { mid: "mid_abc" }, recipient: { chat_id: 442 } } })).toBeNull();
  });

  it("preserves 64-bit MAX chat IDs exactly", () => {
    const payload = JSONbig({ storeAsString: true }).parse('{"update_type":"message_created","chat_id":9223372036854775807,"message":{"recipient":{"chat_id":9223372036854775807,"type":"chat"},"body":{"mid":"mid_big"}}}');
    expect(parseMaxMessage(payload)?.externalChatId).toBe("9223372036854775807");
  });
});
