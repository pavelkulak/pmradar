"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { GachiHero } from "@/components/gachi-hero";

type Chat = {
  id: string;
  platform: "TELEGRAM" | "MAX";
  externalChatId: string;
  externalTitle: string | null;
  displayName: string | null;
  openUrl: string | null;
  enabled: boolean;
  latestSeq: string;
  acknowledgedThroughSeq: string;
  unreadCount: number;
  lastMessageAt: string | null;
  acknowledgedAt: string | null;
};
type ChatResponse = { chats: Chat[]; needsAttention: number; unreadMessages: number };

function SummaryIcon({ kind }: { kind: "eye" | "message" | "group" }) {
  return <span className={`summary-icon summary-icon-${kind}`} aria-hidden="true">
    {kind === "eye" ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2.3 12s3.5-5.7 9.7-5.7 9.7 5.7 9.7 5.7-3.5 5.7-9.7 5.7S2.3 12 2.3 12Z"/><circle cx="12" cy="12" r="2.8"/></svg> : kind === "message" ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 4.5h16v12H9l-5 3v-15Z"/><path d="M8 9h8M8 12.5h5"/></svg> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="8" r="3"/><path d="M2.7 19v-1.5c0-2.2 2.7-4 6.3-4s6.3 1.8 6.3 4V19H2.7ZM16 5.3a2.8 2.8 0 0 1 0 5.4M17.1 13.8c2.6.3 4.2 1.7 4.2 3.7V19h-3.6"/></svg>}
  </span>;
}

function readableDate(value: string | null): string {
  if (!value) return "Пока нет сообщений";
  const date = new Date(value);
  return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }).format(date);
}

function ChatCard({ chat, onAcknowledge, busy }: { chat: Chat; onAcknowledge: (chat: Chat) => void; busy: boolean }) {
  return <article className={`chat-card ${chat.unreadCount > 0 ? "chat-card-unread" : "chat-card-read"}`}>
    <div className="chat-card-main">
      <div className="chat-title-line">
        <h3>{chat.displayName || chat.externalTitle || "Без названия"}</h3>
        <span className={`platform-badge platform-${chat.platform.toLowerCase()}`}><i />{chat.platform === "TELEGRAM" ? "Telegram" : "MAX"}</span>
      </div>
      {chat.unreadCount > 0 ? <p className="unread-count"><span className="unread-dot" />{chat.unreadCount} {chat.unreadCount === 1 ? "новое сообщение" : chat.unreadCount >= 2 && chat.unreadCount <= 4 ? "новых сообщения" : "новых сообщений"}</p> : <p className="read-label"><span aria-hidden="true">✓</span> Всё просмотрено</p>}
      <p className="message-time">Последнее сообщение <time>{readableDate(chat.lastMessageAt)}</time></p>
      {chat.unreadCount === 0 && chat.acknowledgedAt && <p className="ack-time">Ознакомился <time>{readableDate(chat.acknowledgedAt)}</time></p>}
    </div>
    <div className="card-actions">
      {chat.openUrl && <a className="button button-secondary" href={chat.openUrl} target="_blank" rel="noopener noreferrer">Открыть чат <span aria-hidden="true">↗</span></a>}
      {chat.unreadCount > 0 && <button className="button button-primary acknowledge-button" disabled={busy} onClick={() => onAcknowledge(chat)}>{busy ? "Сохраняем…" : "Ознакомился"}</button>}
    </div>
  </article>;
}

export function Dashboard() {
  const [data, setData] = useState<ChatResponse | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [collapsed, setCollapsed] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/chats", { cache: "no-store" });
      if (response.status === 401) { window.location.assign("/login"); return; }
      if (!response.ok) throw new Error("Не удалось загрузить список чатов");
      setData(await response.json());
      setError("");
    } catch {
      setError("Не удалось обновить список. Проверьте подключение и повторите попытку.");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 15_000);
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", onVisible); document.removeEventListener("visibilitychange", onVisible); };
  }, [refresh]);

  const unread = useMemo(() => data?.chats.filter((chat) => chat.unreadCount > 0) ?? [], [data]);
  const read = useMemo(() => data?.chats.filter((chat) => chat.unreadCount === 0) ?? [], [data]);

  async function acknowledge(chat: Chat) {
    setBusyId(chat.id);
    setError("");
    try {
      const response = await fetch(`/api/chats/${chat.id}/acknowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ throughSeq: chat.latestSeq }),
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error ?? "Не удалось подтвердить ознакомление");
      }
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось подтвердить ознакомление");
    } finally {
      setBusyId(null);
    }
  }

  return <div className="gachi-app"><AppHeader active="inbox" /><main className="page-container dashboard-page">
    <GachiHero eyebrow="Рабочие чаты" title="Входящие" description="Все новые сообщения в одном месте." aside={<div className="refresh-status"><span className="live-indicator" />Обновление каждые 15 секунд</div>}>
      {(data?.unreadMessages ?? 0) > 0 && <div className="unread-mascot" role="status"><img src="/gachi/characters/unread-mascot.webp" width="1122" height="1402" alt="Братан, проверь входящие — есть новые сообщения" /></div>}
    </GachiHero>
    <section className="summary-grid" aria-label="Сводка">
      <div className="summary-card attention-summary"><span className="summary-photo summary-photo-attention" aria-hidden="true" /><SummaryIcon kind="eye" /><span className="summary-label">Чатов требуют внимания</span><strong>{data?.needsAttention ?? "—"}</strong></div>
      <div className="summary-card"><span className="summary-photo summary-photo-back" aria-hidden="true" /><SummaryIcon kind="message" /><span className="summary-label">Новых сообщений</span><strong>{data?.unreadMessages ?? "—"}</strong></div>
      <div className="summary-card"><span className="summary-photo summary-photo-back" aria-hidden="true" /><SummaryIcon kind="group" /><span className="summary-label">Контролируемых чатов</span><strong>{data?.chats.length ?? "—"}</strong></div>
    </section>
    {error && <div className="notice notice-error" role="alert">{error}<button onClick={() => void refresh()}>Обновить</button></div>}
    <section className="chat-section">
      <div className="section-heading"><div><div className="section-title"><span className="section-marker marker-attention" /><h2>Требуют внимания</h2><span className="count-pill count-alert">{unread.length}</span></div><p>Сначала показаны самые свежие сообщения</p></div></div>
      {!data ? <div className="empty-state"><span className="skeleton-line" /><span className="skeleton-line short" /><span className="skeleton-button" /></div> : unread.length === 0 ? <div className="empty-state empty-calm"><span className="empty-icon">✓</span><div><h3>Новых сообщений нет</h3><p>Когда в подключённом чате появится сообщение, оно будет здесь.</p></div><div className="empty-figure" aria-hidden="true" /></div> : <div className="chat-list">{unread.map((chat) => <ChatCard key={chat.id} chat={chat} onAcknowledge={acknowledge} busy={busyId === chat.id} />)}</div>}
    </section>
    <section className="chat-section read-section">
      <button className="collapse-heading" aria-expanded={!collapsed} onClick={() => setCollapsed((value) => !value)}><span className="section-title"><span className="section-marker marker-read" /><span className="heading-text"><b>Всё просмотрено</b><small>Нет новых сообщений</small></span><span className="count-pill">{read.length}</span></span><span className={`chevron ${collapsed ? "" : "open"}`} aria-hidden="true">⌄</span></button>
      {!collapsed && (read.length ? <div className="chat-list">{read.map((chat) => <ChatCard key={chat.id} chat={chat} onAcknowledge={acknowledge} busy={busyId === chat.id} />)}</div> : data && <p className="muted read-empty">Здесь появятся чаты после первого сообщения.</p>)}
    </section>
  </main></div>;
}
