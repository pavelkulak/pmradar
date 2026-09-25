"use client";

import { useCallback, useEffect, useState } from "react";

type Integration = { configured: boolean; webhookUrl: string; lastWebhookAt: string | null; lastCheckedAt: string | null; status: string; pendingUpdates: number | null; lastError: string | null; lastErrorAt: string | null };
type State = { telegram: Integration; max: Integration };

function when(value: string | null) { return value ? new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Ещё не получали"; }
function statusName(value: string) { return ({ active: "Активно", inactive: "Не подключено", unreachable: "Нет ответа API", not_configured: "Не настроено", unknown: "Не проверено" } as Record<string, string>)[value] ?? value; }

function IntegrationCard({ name, kind, value }: { name: string; kind: "telegram" | "max"; value: Integration }) {
  const active = value.status === "active";
  const badge = active ? "status-active" : value.status === "unreachable" ? "status-error" : "status-idle";
  return <article className="integration-card">
    <div className="integration-card-head"><div className={`integration-icon integration-${kind}`}>{kind === "telegram" ? "✈" : "M"}</div><div><h2>{name}</h2><p>{value.configured ? "Данные для доступа заданы" : "Не заданы токен или секрет webhook"}</p></div><span className={`status-badge ${badge}`}><i />{statusName(value.status)}</span></div>
    <div className="integration-details">
      <div><span>Webhook URL</span><code>{value.webhookUrl || "Укажите APP_URL в .env"}</code></div>
      <div><span>Последний webhook</span><strong>{when(value.lastWebhookAt)}</strong></div>
      <div><span>Последняя проверка</span><strong>{when(value.lastCheckedAt)}</strong></div>
      {kind === "telegram" && <div><span>Ожидают доставки</span><strong>{value.pendingUpdates ?? "—"}</strong></div>}
      {value.lastError && <div className="integration-error"><span>Последняя ошибка{kind === "telegram" && value.lastErrorAt ? ` · ${when(value.lastErrorAt)}` : ""}</span><strong>{value.lastError}</strong></div>}
      {kind === "max" && <p className="integration-hint">MAX автоматически отключает подписку, если не получает успешный ответ webhook в течение 8 часов. Проверяйте этот статус.</p>}
    </div>
  </article>;
}

export function IntegrationSettings() {
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async (method: "GET" | "POST" = "GET") => {
    if (method === "POST") setBusy(true);
    try {
      const response = await fetch("/api/integrations", { method, cache: "no-store" });
      if (response.status === 401) { window.location.assign("/login"); return; }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Не удалось проверить интеграции");
      setState(result);
      setError("");
      if (method === "POST") setNotice("Проверка завершена. Показан актуальный статус провайдеров.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось проверить интеграции"); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return <>
    <section className="page-heading settings-heading"><div><p className="eyebrow">Подключения</p><h1>Интеграции</h1><p className="muted">Проверьте webhook и доставку событий от мессенджеров.</p></div><button className="button button-primary" disabled={busy} onClick={() => void load("POST")}><span aria-hidden="true">↻</span> {busy ? "Проверяем…" : "Проверить подключения"}</button></section>
    {error && <div className="notice notice-error" role="alert">{error}</div>}
    {notice && <div className="notice notice-success" role="status">{notice}</div>}
    {!state ? <div className="panel loading-panel">Загружаем статус…</div> : <div className="integration-grid"><IntegrationCard name="Telegram" kind="telegram" value={state.telegram} /><IntegrationCard name="MAX" kind="max" value={state.max} /></div>}
    <section className="privacy-note"><span className="privacy-lock">◇</span><div><strong>Пассивный контроль сообщений</strong><p>PM Inbox сохраняет только технические идентификаторы событий и время доставки. Текст, файлы и сведения об отправителях не записываются.</p></div></section>
  </>;
}
