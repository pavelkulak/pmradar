const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const appUrl = process.env.APP_URL?.replace(/\/$/, "");
if (!token || !secret || !appUrl) throw new Error("Set TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET and APP_URL in .env");
if (!/^[A-Za-z0-9_-]{1,256}$/.test(secret)) throw new Error("TELEGRAM_WEBHOOK_SECRET has an invalid format");
const parsedAppUrl = new URL(appUrl);
if (parsedAppUrl.protocol !== "https:" || (parsedAppUrl.port && parsedAppUrl.port !== "443")) throw new Error("Telegram webhooks require APP_URL to use HTTPS on port 443");
const webhookUrl = `${appUrl}/webhooks/telegram`;

async function telegram(method, body) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(`Telegram ${method} failed with HTTP ${response.status}`);
  return data.result ?? {};
}

await telegram("setWebhook", { url: webhookUrl, secret_token: secret, allowed_updates: ["message", "my_chat_member"] });
const info = await telegram("getWebhookInfo");
if (info.url !== webhookUrl) throw new Error("Telegram webhook verification failed: URL does not match");
console.log(`Telegram webhook is active: ${webhookUrl}`);
