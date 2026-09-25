"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export function AppHeader({ active = "inbox" }: { active?: "inbox" | "chats" | "integrations" }) {
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }
  return <header className="topbar">
    <Link className="brand" href="/" aria-label="PM Inbox — главная"><span className="brand-mark">P</span><span>PM <b>Inbox</b></span></Link>
    <nav className="main-nav" aria-label="Главная навигация">
      <Link className={active === "inbox" ? "nav-link active" : "nav-link"} href="/">Входящие</Link>
      <Link className={active === "chats" ? "nav-link active" : "nav-link"} href="/settings/chats">Чаты</Link>
      <Link className={active === "integrations" ? "nav-link active" : "nav-link"} href="/settings/integrations">Интеграции</Link>
    </nav>
    <button className="logout-button" onClick={logout}>Выйти <span aria-hidden="true">↗</span></button>
  </header>;
}
