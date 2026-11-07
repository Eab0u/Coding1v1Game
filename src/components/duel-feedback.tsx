"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { DuelSound, type DuelCue } from "../lib/duel-sound";
import { Button } from "./ui";

const preferenceKey = "codeduel-sound";
const labels: Record<DuelCue, string> = {
  matched: "Match found", passed: "Test passed", failed: "Test failed", win: "Victory", loss: "Defeat", draw: "Honors shared",
};

export function useDuelFeedback() {
  const sound = useRef<DuelSound | null>(null);
  const enabledRef = useRef(false);
  const [enabled, setEnabled] = useState(false);
  const [event, setEvent] = useState<{ cue: DuelCue; sequence: number } | null>(null);
  useEffect(() => {
    try { enabledRef.current = localStorage.getItem(preferenceKey) === "on"; } catch { /* Storage is optional. */ }
    setEnabled(enabledRef.current);
    function syncPreference(event: StorageEvent) {
      try {
        if (event.storageArea !== localStorage || (event.key !== preferenceKey && event.key !== null)) return;
      } catch { return; }
      enabledRef.current = event.key === preferenceKey && event.newValue === "on";
      setEnabled(enabledRef.current);
      // Remote consent updates the control, but audio still needs a local gesture.
      if (!enabledRef.current) { sound.current?.dispose(); sound.current = null; }
    }
    window.addEventListener("storage", syncPreference);
    return () => {
      window.removeEventListener("storage", syncPreference);
      sound.current?.dispose(); sound.current = null;
    };
  }, []);
  function unlock() {
    if (enabledRef.current) { sound.current ??= new DuelSound(); sound.current.unlock(); }
  }
  const notify = useCallback((cue: DuelCue) => {
    if (enabledRef.current && document.visibilityState !== "hidden") sound.current?.play(cue);
    setEvent(previous => ({ cue, sequence: (previous?.sequence ?? 0) + 1 }));
  }, []);
  function toggle() {
    enabledRef.current = !enabledRef.current;
    setEnabled(enabledRef.current);
    try { localStorage.setItem(preferenceKey, enabledRef.current ? "on" : "off"); } catch { /* Keep session preference. */ }
    if (enabledRef.current) { unlock(); notify("passed"); }
    else { sound.current?.dispose(); sound.current = null; }
  }
  return { enabled, event, unlock, notify, toggle };
}

export function DuelFeedback({ feedback }: { feedback: ReturnType<typeof useDuelFeedback> }) {
  return <div className="duel-feedback">
    <Button variant="ghost" aria-pressed={feedback.enabled} onClick={feedback.toggle}>Sound {feedback.enabled ? "on" : "off"}</Button>
    <span className="duel-feedback-status" aria-live="polite">
      {feedback.event && <span key={feedback.event.sequence} className={`duel-cue duel-cue--${feedback.event.cue}`}>{labels[feedback.event.cue]}</span>}
    </span>
  </div>;
}
