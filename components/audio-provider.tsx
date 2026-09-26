"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

type AudioControls = {
  playing: boolean;
  blocked: boolean;
  muted: boolean;
  resetAfterLogin: () => void;
  ensurePlayback: () => void;
  resume: () => void;
  mute: () => void;
  stopForLogout: () => void;
};

const AudioContext = createContext<AudioControls | null>(null);
const MUTE_KEY = "pm-gachi-audio-muted";

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [muted, setMuted] = useState(false);

  const getAudio = useCallback(() => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.loop = true;
      audio.preload = "auto";
      audio.src = "/audio/gachi-remix.mp3";
      audio.addEventListener("play", () => setPlaying(true));
      audio.addEventListener("pause", () => setPlaying(false));
      audio.load();
      audioRef.current = audio;
    }
    return audioRef.current;
  }, []);

  const tryPlay = useCallback((audio: HTMLAudioElement) => {
    void audio.play().then(() => setBlocked(false)).catch(() => {
      setBlocked(true);
      setPlaying(false);
    });
  }, []);

  useEffect(() => {
    const savedMuted = sessionStorage.getItem(MUTE_KEY) === "true";
    if (savedMuted) setMuted(true);
    // Download the track while the login form is open, but never play it there.
    const audio = getAudio();
    audio.volume = 1;
    sessionStorage.removeItem("pm-gachi-audio-volume");
    return () => { audioRef.current?.pause(); };
  }, [getAudio]);

  const resetAfterLogin = useCallback(() => {
    sessionStorage.removeItem(MUTE_KEY);
    setMuted(false);
    setBlocked(false);
  }, []);

  const ensurePlayback = useCallback(() => {
    if (sessionStorage.getItem(MUTE_KEY) === "true") return;
    const audio = getAudio();
    audio.volume = 1;
    if (audio.paused) tryPlay(audio);
  }, [getAudio, tryPlay]);

  const resume = useCallback(() => {
    sessionStorage.removeItem(MUTE_KEY);
    setMuted(false);
    const audio = getAudio();
    audio.volume = 1;
    tryPlay(audio);
  }, [getAudio, tryPlay]);

  const mute = useCallback(() => {
    sessionStorage.setItem(MUTE_KEY, "true");
    setMuted(true);
    setBlocked(false);
    audioRef.current?.pause();
  }, []);

  const stopForLogout = useCallback(() => {
    const audio = audioRef.current;
    if (audio) { audio.pause(); audio.currentTime = 0; }
    sessionStorage.removeItem(MUTE_KEY);
    setMuted(false);
    setBlocked(false);
  }, []);

  return <AudioContext.Provider value={{ playing, blocked, muted, resetAfterLogin, ensurePlayback, resume, mute, stopForLogout }}>{children}</AudioContext.Provider>;
}

export function useGachiAudio() {
  const context = useContext(AudioContext);
  if (!context) throw new Error("AudioProvider is missing");
  return context;
}
