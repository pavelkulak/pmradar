const api = "https://platform-api2.max.ru";
const token = process.env.MAX_BOT_TOKEN;
if (!token) throw new Error("Set MAX_BOT_TOKEN in .env");
const response = await fetch(`${api}/subscriptions`, { headers: { Authorization: token }, signal: AbortSignal.timeout(15_000) });
if (!response.ok) throw new Error(`MAX GET /subscriptions failed with HTTP ${response.status}`);
const result = await response.json();
const expectedUrl = `${process.env.APP_URL?.replace(/\/$/, "")}/webhooks/max`;
const current = result.subscriptions?.find((subscription) => subscription.url === expectedUrl);
if (!current) {
  console.log("MAX webhook subscription is not active for this APP_URL.");
  process.exitCode = 1;
} else {
  console.log(`MAX webhook subscription found (${current.update_types?.length ?? 0} event types).`);
}
