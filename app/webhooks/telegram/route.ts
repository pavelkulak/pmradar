import { NextRequest, NextResponse } from "next/server";
import JSONbig from "json-bigint";
import { ingestMessage, parseTelegramMessage } from "@/lib/event-ingestion";
import { safeError } from "@/lib/api";
import { isWebhookSecretValid } from "@/lib/webhook-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const receivedAt = new Date();
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const providedSecret = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!expectedSecret) return NextResponse.json({ error: "Webhook is not configured" }, { status: 503 });
  if (!isWebhookSecretValid(expectedSecret, providedSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 1_048_576) return NextResponse.json({ error: "Payload too large" }, { status: 413 });

  let update: unknown;
  try {
    update = JSONbig({ storeAsString: true }).parse(await request.text());
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const event = parseTelegramMessage(update, receivedAt);
  try {
    const result = event ? await ingestMessage(event) : "ignored";
    console.info(JSON.stringify({ platform: "TELEGRAM", chatExternalId: event?.externalChatId ?? null, eventId: event?.platformEventId ?? null, receivedAt: receivedAt.toISOString(), result, durationMs: Date.now() - startedAt }));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(JSON.stringify({ platform: "TELEGRAM", chatExternalId: event?.externalChatId ?? null, eventId: event?.platformEventId ?? null, receivedAt: receivedAt.toISOString(), result: "error", error: safeError(error), durationMs: Date.now() - startedAt }));
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
