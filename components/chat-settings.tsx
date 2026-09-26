"use client";

import { useCallback, useEffect, useState } from "react";
import { GachiHero } from "@/components/gachi-hero";

type Chat = {
  id: string; platform: "TELEGRAM" | "MAX"; externalChatId: string; externalTitle: string | null;
  displayName: string | null; openUrl: string | null; enabled: boolean; lastMessageAt: string | null; lastWebhookAt: string | null;
};

function dateTime(value: string | null) {
  return value ? new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
}

export function ChatSettings() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [saved, setSaved] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/chats?includeDisabled=1", { cache: "no-store" });
      if (response.status === 401) { window.location.assign("/login"); return; }
      if (!response.ok) throw new Error("Не удалось загрузить чаты");
      const result = await response.json() as { chats: Chat[] };
      setChats(result.chats);
      setSaved(new Map(result.chats.map((chat) => [chat.id, JSON.stringify([chat.displayName ?? "", chat.openUrl ?? "", chat.enabled])])));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось загрузить чаты");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  function change(id: string, patch: Partial<Chat>) {
    setChats((items) => items.map((chat) => chat.id === id ? { ...chat, ...patch } : chat));
    setMessage("");
  }

  async function save(chat: Chat) {
    setSavingId(chat.id); setMessage(""); setError("");
    try {
      const response = await fetch("/api/chats", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: chat.id, displayName: chat.displayName || null, openUrl: chat.openUrl || null, enabled: chat.enabled }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Не удалось сохранить изменения");
      setSaved((previous) => new Map(previous).set(chat.id, JSON.stringify([chat.displayName ?? "", chat.openUrl ?? "", chat.enabled])));
      setMessage("Настройки сохранены.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось сохранить изменения");
    } finally { setSavingId(null); }
  }

  return <>
    <GachiHero eyebrow="Параметры" title="Рабочие чаты" description="Чаты появляются здесь автоматически после первого сообщения от бота." variant="chats" aside={<div className="settings-total"><strong>{chats.length}</strong><span>обнаружено</span></div>} />
    {error && <div className="notice notice-error" role="alert">{error}</div>}
    {message && <div className="notice notice-success" role="status">{message}</div>}
    {loading ? <div className="panel loading-panel">Загружаем чаты…</div> : chats.length === 0 ? <div className="panel empty-settings"><span className="empty-icon">⌁</span><h2>Пока чатов нет</h2><p>Добавьте бота в рабочую группу и отправьте сообщение, чтобы она появилась в списке.</p></div> : <div className="settings-list">
      {chats.map((chat) => {
        const current = JSON.stringify([chat.displayName ?? "", chat.openUrl ?? "", chat.enabled]);
        const dirty = saved.get(chat.id) !== current;
        return <article key={chat.id} className={`settings-chat panel ${!chat.enabled ? "row-disabled" : ""}`}>
          <div className="settings-chat-top">
            <div><span className="field-caption">Чат</span><h2 className="table-chat-name">{chat.externalTitle || "Без названия"}</h2></div>
            <div className="settings-platform"><span className="field-caption">Платформа и ID</span><span className={`platform-badge platform-${chat.platform.toLowerCase()}`}>{chat.platform === "TELEGRAM" ? "Telegram" : "MAX"}</span><code>{chat.externalChatId}</code></div>
          </div>
          <div className="settings-fields">
            <label className="settings-field"><span className="field-caption">Название карточки</span><input className="table-input" placeholder="Как в мессенджере" value={chat.displayName ?? ""} onChange={(event) => change(chat.id, { displayName: event.target.value || null })} /></label>
            <label className="settings-field"><span className="field-caption">Открыть чат</span><input className="table-input url-input" aria-label="Ссылка на чат" placeholder="https://… или tg://…" value={chat.openUrl ?? ""} onChange={(event) => change(chat.id, { openUrl: event.target.value || null })} /></label>
            <div className="settings-field"><span className="field-caption">Мониторинг</span><label className="switch-label"><input type="checkbox" checked={chat.enabled} onChange={(event) => change(chat.id, { enabled: event.target.checked })} /><span className="switch-control" /><span>{chat.enabled ? "Включён" : "Выключен"}</span></label></div>
          </div>
          <div className="settings-chat-bottom">
            <div className="settings-dates"><div><span className="field-caption">Последнее сообщение</span><span className="table-date">{dateTime(chat.lastMessageAt)}</span></div><div><span className="field-caption">Последний webhook</span><span className="table-date">{dateTime(chat.lastWebhookAt)}</span></div></div>
            <button className="button button-small button-secondary" disabled={!dirty || savingId === chat.id} onClick={() => void save(chat)}>{savingId === chat.id ? "Сохраняем…" : "Сохранить"}</button>
          </div>
        </article>;
      })}
    <p className="table-note">Содержимое сообщений не сохраняется. В базе остаются только технические ID и время событий.</p></div>}
  </>;
}
