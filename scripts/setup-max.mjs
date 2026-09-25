const api = "https://platform-api2.max.ru";
const token = process.env.MAX_BOT_TOKEN;
const secret = process.env.MAX_WEBHOOK_SECRET;
const appUrl = process.env.APP_URL?.replace(/\/$/, "");
if (!token || !secret || !appUrl) throw new Error("Set MAX_BOT_TOKEN, MAX_WEBHOOK_SECRET and APP_URL in .env");
if (!/^[A-Za-z0-9_-]{5,256}$/.test(secret)) throw new Error("MAX_WEBHOOK_SECRET must be 5-256 letters, digits, underscores or hyphens");
const parsedAppUrl = new URL(appUrl);
if (parsedAppUrl.protocol !== "https:" || (parsedAppUrl.port && parsedAppUrl.port !== "443")) throw new Error("MAX webhooks require APP_URL to use HTTPS on port 443");
const url = `${appUrl}/webhooks/max`;

async function getSubscriptions() {
  const response = await fetch(`${api}/subscriptions`, { headers: { Authorization: token }, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`MAX GET /subscriptions failed with HTTP ${response.status}`);
  return await response.json();
}

const response = await fetch(`${api}/subscriptions`, {
  method: "POST",
  headers: { Authorization: token, "Content-Type": "application/json" },
  body: JSON.stringify({ url, secret, update_types: ["message_created", "bot_added", "bot_removed", "bot_admin_permissions_changed"] }),
  signal: AbortSignal.timeout(15_000),
});
let result;
try { result = await response.json(); } catch { throw new Error(`MAX POST /subscriptions failed with HTTP ${response.status}`); }
if (!response.ok || result.success === false) throw new Error(`MAX POST /subscriptions failed with HTTP ${response.status}`);
const current = await getSubscriptions();
if (!current.subscriptions?.some((subscription) => subscription.url === url && subscription.update_types?.includes("message_created"))) {
  throw new Error("MAX webhook verification failed: subscription not found");
}
console.log(`MAX webhook is active: ${url}`);
