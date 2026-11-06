"use client";
/* Browser storage must be read after hydration, and write failures update the visible save status. */
/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";

/** Tab-scoped recovery only; drafts never enter shared localStorage. */
export function useArenaDraft(matchId: string, username: string, signature: string, closed: boolean) {
  const key = `codeduel:draft:${encodeURIComponent(username)}:${matchId}`;
  const [source, setSource] = useState(`${signature}\n    pass\n`);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    try {
      const draft = sessionStorage.getItem(key);
      if (!closed && draft !== null) setSource(draft);
    } catch { /* Editing still works when storage is blocked. */ }
    setLoaded(true);
  }, [key, closed]);
  useEffect(() => {
    if (!loaded) return;
    try {
      if (closed) sessionStorage.removeItem(key);
      else sessionStorage.setItem(key, source);
      setSaved(!closed);
    } catch { setSaved(false); }
  }, [key, source, closed, loaded]);
  return { source, setSource, saved };
}
