"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useGachiAudio } from "@/components/audio-provider";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const audio = useGachiAudio();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      if (!response.ok) {
        const result = await response.json();
        setError(result.error ?? "Не удалось войти");
        return;
      }
      audio.resetAfterLogin();
      router.replace("/");
      router.refresh();
    } catch {
      setError("Не удалось связаться с сервером");
    } finally {
      setBusy(false);
    }
  }

  return <main className="login-screen">
    <div className="login-card">
      <div className="brand-mark login-mark">P</div>
      <p className="eyebrow">Рабочее пространство PM</p>
      <h1>Вход в PM Inbox</h1>
      <p className="muted login-description">Следите за новыми сообщениями в рабочих чатах.</p>
      <form onSubmit={submit} className="login-form">
        <label>Email<input autoComplete="username" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label>Пароль<input autoComplete="current-password" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button button-primary button-wide" disabled={busy}>{busy ? "Входим…" : "Войти"}</button>
      </form>
      <p className="login-footnote">Доступ только для администратора.</p>
    </div>
  </main>;
}
