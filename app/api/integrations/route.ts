import { NextRequest, NextResponse } from "next/server";
import { Platform } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/api";
import { checkAndSaveIntegrations } from "@/lib/integrations";

export const dynamic = "force-dynamic";

const webhookUrl = (path: string) => `${process.env.APP_URL?.replace(/\/$/, "") ?? ""}${path}`;

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth) return auth;
  const states = await db.integrationStatus.findMany();
  const byPlatform = new Map(states.map((state) => [state.platform, state]));
  const telegram = byPlatform.get(Platform.TELEGRAM);
  const max = byPlatform.get(Platform.MAX);
  return NextResponse.json({
    telegram: {
      configured: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_WEBHOOK_SECRET),
      webhookUrl: webhookUrl("/webhooks/telegram"),
      lastWebhookAt: telegram?.lastWebhookAt ?? null,
      lastCheckedAt: telegram?.lastCheckedAt ?? null,
      status: telegram?.providerStatus ?? "unknown",
      pendingUpdates: telegram?.pendingUpdates ?? null,
      lastError: telegram?.lastError ?? null,
      lastErrorAt: telegram?.lastErrorAt ?? null,
    },
    max: {
      configured: Boolean(process.env.MAX_BOT_TOKEN && process.env.MAX_WEBHOOK_SECRET),
      webhookUrl: webhookUrl("/webhooks/max"),
      lastWebhookAt: max?.lastWebhookAt ?? null,
      lastCheckedAt: max?.lastCheckedAt ?? null,
      status: max?.providerStatus ?? "unknown",
      lastError: max?.lastError ?? null,
      lastErrorAt: max?.lastErrorAt ?? null,
    },
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth) return auth;
  await checkAndSaveIntegrations();
  return GET(request);
}
