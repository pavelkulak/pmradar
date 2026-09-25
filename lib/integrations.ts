import "server-only";
import { Platform } from "@prisma/client";
import { db } from "@/lib/db";

export const MAX_API = "https://platform-api2.max.ru";

type ProviderResult = { status: string; pendingUpdates: number | null; lastError: string | null; lastErrorAt: Date | null };

async function saveStatus(platform: Platform, result: ProviderResult) {
  return db.integrationStatus.upsert({
    where: { platform },
    create: { platform, lastCheckedAt: new Date(), providerStatus: result.status, pendingUpdates: result.pendingUpdates, lastError: result.lastError, lastErrorAt: result.lastErrorAt },
    update: { lastCheckedAt: new Date(), providerStatus: result.status, pendingUpdates: result.pendingUpdates, lastError: result.lastError, lastErrorAt: result.lastErrorAt },
  });
}

export async function checkTelegram(): Promise<ProviderResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { status: "not_configured", pendingUpdates: null, lastError: null, lastErrorAt: null };
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return { status: "unreachable", pendingUpdates: null, lastError: `Telegram API вернул HTTP ${response.status}`, lastErrorAt: null };
    const result = await response.json() as { ok?: boolean; result?: { url?: string; pending_update_count?: number; last_error_message?: string; last_error_date?: number } };
    if (!result.ok || !result.result) return { status: "unreachable", pendingUpdates: null, lastError: "Telegram API вернул некорректный ответ", lastErrorAt: null };
    const expectedUrl = `${process.env.APP_URL?.replace(/\/$/, "")}/webhooks/telegram`;
    const active = result.result.url === expectedUrl;
    return {
      status: active ? "active" : "inactive",
      pendingUpdates: Number.isInteger(result.result.pending_update_count) ? result.result.pending_update_count! : null,
      lastError: result.result.last_error_message?.slice(0, 300) ?? null,
      lastErrorAt: result.result.last_error_date ? new Date(result.result.last_error_date * 1000) : null,
    };
  } catch {
    return { status: "unreachable", pendingUpdates: null, lastError: "Не удалось связаться с Telegram API", lastErrorAt: null };
  }
}

export async function checkMax(): Promise<ProviderResult> {
  const token = process.env.MAX_BOT_TOKEN;
  if (!token) return { status: "not_configured", pendingUpdates: null, lastError: null, lastErrorAt: null };
  try {
    const response = await fetch(`${MAX_API}/subscriptions`, { headers: { Authorization: token }, cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return { status: "unreachable", pendingUpdates: null, lastError: `MAX API вернул HTTP ${response.status}`, lastErrorAt: null };
    const result = await response.json() as { subscriptions?: Array<{ url?: string; update_types?: string[] }> };
    const expectedUrl = `${process.env.APP_URL?.replace(/\/$/, "")}/webhooks/max`;
    const subscription = result.subscriptions?.find((item) => item.url === expectedUrl);
    const active = Boolean(subscription?.update_types?.includes("message_created"));
    return { status: active ? "active" : "inactive", pendingUpdates: null, lastError: null, lastErrorAt: null };
  } catch {
    return { status: "unreachable", pendingUpdates: null, lastError: "Не удалось связаться с MAX API", lastErrorAt: null };
  }
}

export async function checkAndSaveIntegrations() {
  const [telegram, max] = await Promise.all([checkTelegram(), checkMax()]);
  const [telegramState, maxState] = await Promise.all([
    saveStatus(Platform.TELEGRAM, telegram),
    saveStatus(Platform.MAX, max),
  ]);
  return [telegramState, maxState];
}
