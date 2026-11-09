"use client";
/* Browser storage must be read after hydration, and write failures update the visible save status. */
/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useRef, useState } from "react";

/** Tab-scoped recovery only; drafts never enter shared localStorage. */
export function useArenaDraft(matchId: string, username: string, signature: string, closed: boolean) {
  const key = `codeduel:draft:${encodeURIComponent(username)}:${matchId}`;
  const [source, setSource] = useState(`${signature}\n    pass\n`);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [readFailed, setReadFailed] = useState(false);
  const [readRetryFailures, setReadRetryFailures] = useState(0);
  const automaticSaveBlocked = useRef(false);
  const edited = source !== `${signature}\n    pass\n`;
  useEffect(() => {
    if (closed || (!edited && !readFailed)) return;
    function warnBeforeLeaving(event: BeforeUnloadEvent) {
      event.preventDefault();
      // Older browsers require returnValue as well as preventDefault.
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [closed, edited, readFailed]);
  useEffect(() => {
    try {
      const draft = sessionStorage.getItem(key);
      if (!closed && draft !== null) setSource(draft);
    } catch {
      // A failed read does not mean the slot is empty; require an explicit save.
      automaticSaveBlocked.current = true;
      setReadFailed(true);
    }
    setLoaded(true);
  }, [key, closed]);
  const saveDraft = useCallback((explicit = false) => {
    if (!loaded) return false;
    if (!closed && (readFailed || automaticSaveBlocked.current) && !explicit) return false;
    try {
      if (closed) sessionStorage.removeItem(key);
      else sessionStorage.setItem(key, source);
      automaticSaveBlocked.current = false;
      setReadFailed(false);
      setReadRetryFailures(0);
      setSaved(!closed);
      return !closed;
    } catch { setSaved(false); return false; }
  }, [key, source, closed, loaded, readFailed]);
  useEffect(() => { saveDraft(); }, [saveDraft]);
  function retrySaving() {
    return !closed && !saved && saveDraft(true);
  }
  const canRetryReading = readFailed && !edited && !closed;
  function retryReading() {
    if (!canRetryReading) return false;
    try {
      const draft = sessionStorage.getItem(key);
      if (draft !== null) setSource(draft);
      automaticSaveBlocked.current = false;
      setReadFailed(false);
      setReadRetryFailures(0);
      return true;
    } catch {
      setReadRetryFailures(count => count + 1);
      return false;
    }
  }
  return { source, setSource, saved, readFailed, readRetryFailures, retrySaving, canRetryReading, retryReading };
}
