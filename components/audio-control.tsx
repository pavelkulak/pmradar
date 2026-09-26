"use client";

import { useEffect, useRef, useState } from "react";
import { useGachiAudio } from "@/components/audio-provider";

const DIRECTIONS = [
  { at: 0, counterClockwise: false },
  { at: 35, counterClockwise: true },
  { at: 57, counterClockwise: false },
  { at: 74, counterClockwise: true },
  { at: 86, counterClockwise: false },
  { at: 94, counterClockwise: true },
];

function randomCode() { return String(Math.floor(1000 + Math.random() * 9000)); }

export function AudioControl() {
  const audio = useGachiAudio();
  const [popover, setPopover] = useState(false);
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState(1);
  const [dial, setDial] = useState(73.4);
  const [escapes, setEscapes] = useState(0);
  const [code, setCode] = useState("");
  const [codeVisible, setCodeVisible] = useState(false);
  const [enteredCode, setEnteredCode] = useState("");
  const [codeHint, setCodeHint] = useState("");
  const [codeAttempt, setCodeAttempt] = useState(0);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [rotationHint, setRotationHint] = useState("Следуй за стрелкой, брат.");
  const [holding, setHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [holdHint, setHoldHint] = useState("Стабильность: ожидаем железную хватку.");
  const [complete, setComplete] = useState(false);
  const controlRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLElement>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const lastAngleRef = useRef<number | null>(null);
  const holdStartRef = useRef(0);
  const holdOriginRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => { audio.ensurePlayback(); }, []); // One attempt on authenticated page load.

  useEffect(() => {
    if (!audio.blocked || audio.muted) return;
    const retry = () => audio.ensurePlayback();
    const retryFromKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") retry();
    };
    // A reload clears browser user activation. Retry on the next real gesture.
    window.addEventListener("pointerdown", retry, { capture: true, once: true });
    window.addEventListener("keydown", retryFromKeyboard, true);
    return () => {
      window.removeEventListener("pointerdown", retry, true);
      window.removeEventListener("keydown", retryFromKeyboard, true);
    };
  }, [audio.blocked, audio.muted, audio.ensurePlayback]);

  useEffect(() => {
    if (!popover) return;
    const closeOutside = (event: PointerEvent) => {
      if (!controlRef.current?.contains(event.target as Node)) setPopover(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [popover]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); setHolding(false); triggerRef.current?.focus(); }
      if (event.key === "Tab") {
        const elements = modalRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]');
        if (!elements?.length) return;
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (stage !== 3 || !open) return;
    const next = randomCode();
    setCode(next);
    setCodeVisible(true);
    setEnteredCode("");
    const timer = window.setTimeout(() => { setCodeVisible(false); codeInputRef.current?.focus(); }, 1200);
    return () => window.clearTimeout(timer);
  }, [stage, open, codeAttempt]);

  useEffect(() => {
    if (!open || !holding || stage !== 5) return;
    const interval = window.setInterval(() => {
      const next = Math.min(100, (performance.now() - holdStartRef.current) / 30);
      setHoldProgress(next);
      if (next >= 100) {
        setHolding(false);
        window.clearInterval(interval);
        audio.mute();
        setComplete(true);
      }
    }, 35);
    return () => window.clearInterval(interval);
  }, [holding, stage, open, audio]);

  const openWizard = () => {
    setPopover(false);
    setStage(1);
    setDial(73.4);
    setEscapes(0);
    setCodeHint("");
    setCodeAttempt(0);
    setProgress(0);
    setPhase(0);
    setRotation(0);
    setHolding(false);
    setHoldProgress(0);
    setComplete(false);
    setOpen(true);
  };

  const dialFromPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const angle = Math.atan2(event.clientY - rect.top - rect.height / 2, event.clientX - rect.left - rect.width / 2) * 180 / Math.PI;
    let normalized = angle + 90;
    if (normalized < -180) normalized += 360;
    if (normalized > 180) normalized -= 360;
    setDial(Math.round(Math.max(0, Math.min(100, (normalized + 150) / 3)) * 10) / 10);
  };

  const confirmCode = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    setEnteredCode(digits);
    if (digits.length < 4) return;
    if (digits === code) { setCodeHint("Код принят. Штанга разблокирована."); window.setTimeout(() => setStage(4), 450); }
    else { setCodeHint("Промах, брат. Лови новый код."); }
  };

  const rotateBy = (delta: number) => {
    setRotation((current) => current + delta);
    const correct = (delta < 0) === DIRECTIONS[phase].counterClockwise;
    const next = Math.max(0, Math.min(100, progress + Math.abs(delta) * (correct ? .18 : -.27)));
    setProgress(next);
    if (!correct) { setRotationHint("Не та сторона. Смотри на стрелку!"); return; }
    const nextPhase = DIRECTIONS[phase + 1];
    if (nextPhase && next >= nextPhase.at) {
      setPhase(phase + 1);
      setRotationHint("Смена подхода! Направление поменялось.");
    } else setRotationHint("Чисто идёшь. Продолжай крутить.");
    if (next >= 100 && phase === DIRECTIONS.length - 1) setStage(5);
  };

  const pointerAngle = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return Math.atan2(event.clientY - rect.top - rect.height / 2, event.clientX - rect.left - rect.width / 2) * 180 / Math.PI;
  };

  const beginHold = (x: number, y: number) => {
    holdOriginRef.current = { x, y };
    holdStartRef.current = performance.now();
    setHoldHint("Держи крепче, брат. Без рывков.");
    setHoldProgress(0);
    setHolding(true);
  };
  const endHold = (hint = "Сорвался хват. Попробуй ещё раз.") => {
    if (!complete) { setHolding(false); setHoldProgress(0); setHoldHint(hint); }
  };

  return <div className="gachi-audio-control" ref={controlRef}>
    <button ref={triggerRef} className={`gachi-audio-trigger${audio.muted ? " is-muted" : ""}${audio.blocked && !audio.muted ? " needs-gesture" : ""}`} type="button" aria-label={audio.blocked && !audio.muted ? "Включить звук" : "Настройки громкости"} aria-expanded={popover} onClick={() => setPopover((value) => !value)}>
      <span aria-hidden="true">{audio.muted ? "◌" : audio.blocked ? "▶" : "♫"}</span><span className="gachi-audio-trigger-text">{audio.blocked && !audio.muted ? "Включить бит" : "Звук"}</span>
      {audio.playing && <i className="gachi-audio-live" aria-hidden="true" />}
    </button>
    {popover && <div className="gachi-audio-popover" role="group" aria-label="Настройки звука">
      <p className="gachi-audio-kicker">ЗВУК РАЗДЕВАЛКИ</p>
      <strong>Gachi Remix</strong>
      <p className="gachi-audio-state">{audio.muted ? "Тишина на базе" : audio.blocked ? "Браузер придержал бит" : audio.playing ? "Бит качает" : "Трек готов к запуску"}</p>
      {audio.blocked && !audio.muted && <button type="button" className="gachi-audio-retry" onClick={audio.ensurePlayback}>Запустить бит вручную</button>}
      <p className="gachi-audio-volume-label">Громкость <b>{audio.muted ? "ВЫКЛ" : "100%"}</b></p>
      <p className="gachi-audio-note">{audio.muted ? "Бит ждёт нового подхода." : "Регулятор зафиксирован. Отключить бит можно только после испытания."}</p>
      {audio.muted ? <button type="button" className="gachi-audio-advanced" onClick={audio.resume}>Включить звук <span aria-hidden="true">↗</span></button> : <button type="button" className="gachi-audio-advanced" onClick={openWizard}>Пройти челлендж тишины <span aria-hidden="true">↗</span></button>}
    </div>}
    {open && <div className="gachi-audio-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) { setOpen(false); setHolding(false); triggerRef.current?.focus(); } }}>
      <section ref={modalRef} className="gachi-audio-modal" role="dialog" aria-modal="true" aria-labelledby="gachi-audio-title">
        <div className="gachi-audio-modal-head"><span>PM INBOX / ПРОТОКОЛ ТИШИНЫ</span><button ref={closeRef} type="button" aria-label="Закрыть настройки звука" onClick={() => { setOpen(false); setHolding(false); triggerRef.current?.focus(); }}>×</button></div>
        {complete ? <div className="gachi-audio-stage"><p className="gachi-audio-step">ИСПЫТАНИЕ ПРОЙДЕНО</p><h2 id="gachi-audio-title">Тишина заслужена, брат</h2><p className="gachi-audio-description">Бит остановлен. Когда захочешь снова в зал — включи его в хедере.</p><button className="gachi-audio-primary" type="button" onClick={() => setOpen(false)}>Вернуться к чатам</button></div> : <div className="gachi-audio-stage">
          <p className="gachi-audio-step">ПОДХОД {stage} / 5 <span>{["ТОЧНОСТЬ", "НАМЕРЕНИЕ", "ПАМЯТЬ", "КАЛИБРОВКА", "ХВАТКА"][stage - 1]}</span></p>
          {stage === 1 && <><h2 id="gachi-audio-title">Выкрути тишину в ноль</h2><p className="gachi-audio-description">Поверни регулятор ровно на <b>0,0%</b>. Меньше уже некуда, брат.</p>
            <div className="gachi-audio-dial-row"><div className="gachi-audio-dial" role="slider" tabIndex={0} aria-label="Уровень тишины" aria-valuemin={0} aria-valuemax={100} aria-valuenow={dial} onKeyDown={(event) => { if (event.key === "ArrowDown" || event.key === "ArrowLeft") setDial((n) => Math.max(0, Math.round((n - 1) * 10) / 10)); if (event.key === "Home") setDial(0); }} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); dialFromPointer(event); }} onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) dialFromPointer(event); }}><span className="gachi-audio-dial-pointer" style={{ transform: `translateX(-50%) rotate(${-150 + dial * 3}deg)` }} /><span className="gachi-audio-dial-core">PM</span></div><div><strong className="gachi-audio-big-value">{dial.toFixed(1).replace(".", ",")}%</strong><p className="gachi-audio-hint">{dial === 0 ? "Ноль взят. Жми дальше." : "Нужна точность до десятых."}</p></div></div>
            <button className="gachi-audio-primary" type="button" disabled={dial !== 0} onClick={() => setStage(2)}>Проверить уровень тишины</button></>}
          {stage === 2 && <><h2 id="gachi-audio-title">Подтверди намерение</h2><p className="gachi-audio-description">Система не верит, что ты хочешь выключить этот бит. Поймай кнопку пять раз, потом нажми.</p><div className="gachi-audio-intent-arena"><button className="gachi-audio-intent" style={{ left: `${15 + (escapes * 17) % 58}%`, top: `${23 + (escapes * 31) % 48}%` }} type="button" onPointerEnter={(event) => { if (event.pointerType === "mouse" && escapes < 5) setEscapes((n) => n + 1); }} onClick={(event) => { if (escapes >= 5) { setCodeHint(""); setStage(3); } else if (event.detail === 0 || window.matchMedia("(pointer: coarse)").matches) setEscapes((n) => n + 1); }}>Я точно хочу тишину</button></div><p className="gachi-audio-hint">Уверенность тренера: {41 + escapes * 9}% · {escapes < 5 ? "Не сдавайся, брат." : "Теперь кнопка твоя."}</p></>}
          {stage === 3 && <><h2 id="gachi-audio-title">Запомни код шкафчика</h2><p className="gachi-audio-description">У тебя секунда с небольшим. Запомни четыре цифры, затем введи их.</p><div className="gachi-audio-code">{codeVisible ? code : "••••"}</div><label className="gachi-audio-input-label" htmlFor="gachi-code">Код доступа</label><input ref={codeInputRef} id="gachi-code" inputMode="numeric" autoComplete="off" maxLength={4} value={enteredCode} disabled={codeVisible || codeHint.startsWith("Код принят")} onChange={(event) => confirmCode(event.target.value)} placeholder="Четыре цифры" /><p className="gachi-audio-hint" role="status">{codeHint || "Шкафчик ждёт комбинацию."}</p>{codeHint.startsWith("Промах") && <button className="gachi-audio-secondary" type="button" onClick={() => { setCodeHint(""); setCodeAttempt((n) => n + 1); }}>Показать новый код</button>}</>}
          {stage === 4 && <><h2 id="gachi-audio-title">Раскрути привод</h2><p className="gachi-audio-description">Крути диск по стрелке. Направление меняется на новых отметках — следи за ним.</p><p className="gachi-audio-direction">{DIRECTIONS[phase].counterClockwise ? "↺ ПРОТИВ часовой" : "↻ ПО часовой"}</p><div className="gachi-audio-rotation" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); lastAngleRef.current = pointerAngle(event); }} onPointerMove={(event) => { if (!event.currentTarget.hasPointerCapture(event.pointerId) || lastAngleRef.current === null) return; const angle = pointerAngle(event); let delta = angle - lastAngleRef.current; if (delta > 180) delta -= 360; if (delta < -180) delta += 360; lastAngleRef.current = angle; if (Math.abs(delta) > .25) rotateBy(delta); }} onPointerUp={() => { lastAngleRef.current = null; }} onPointerCancel={() => { lastAngleRef.current = null; }}><span className="gachi-audio-rotation-marker" style={{ transform: `translateX(-50%) rotate(${rotation}deg)` }} /><b>{Math.floor(progress)}%</b></div><div className="gachi-audio-rotation-buttons"><button type="button" onClick={() => rotateBy(-30)}>↺ Против</button><button type="button" onClick={() => rotateBy(30)}>По часовой ↻</button></div><div className="gachi-audio-progress"><span style={{ width: `${progress}%` }} /></div><p className="gachi-audio-hint" role="status">{rotationHint}</p></>}
          {stage === 5 && <><h2 id="gachi-audio-title">Финальный хват</h2><p className="gachi-audio-description">Удерживай кнопку три секунды, не двигая указатель. Сохраняй форму до конца подхода.</p><button className="gachi-audio-hold" type="button" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); beginHold(event.clientX, event.clientY); }} onPointerMove={(event) => { if (holding && holdOriginRef.current && Math.hypot(event.clientX - holdOriginRef.current.x, event.clientY - holdOriginRef.current.y) > 9) endHold("Слишком резкое движение. Повтори подход."); }} onPointerUp={() => endHold()} onPointerCancel={() => endHold()} onKeyDown={(event) => { if (!event.repeat && (event.key === " " || event.key === "Enter")) beginHold(0, 0); }} onKeyUp={(event) => { if (event.key === " " || event.key === "Enter") endHold(); }}><span className="gachi-audio-hold-fill" style={{ width: `${holdProgress}%` }} /><span>{holding ? `Держи… ${Math.floor(holdProgress)}%` : "Удерживать для тишины"}</span></button><p className="gachi-audio-hint" role="status">{holdHint}</p></>}
        </div>}
      </section>
    </div>}
  </div>;
}
