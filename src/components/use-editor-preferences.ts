"use client";
/* Read browser preferences after hydration; storage failures must remain visible. */
/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";

const key = "codeduel:editor-preferences:v1";
type Preferences = { plain: boolean; wordWrap: boolean; fontSize: number };
const defaults: Preferences = { plain: false, wordWrap: false, fontSize: 15 };

export function useEditorPreferences() {
  const [preferences, setPreferences] = useState(defaults);
  const [loaded, setLoaded] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        // Stored data is untrusted. Invalid fields independently use safe defaults.
        const value = JSON.parse(raw);
        if (value && typeof value === "object") setPreferences({
          plain: typeof value.plain === "boolean" ? value.plain : defaults.plain,
          wordWrap: typeof value.wordWrap === "boolean" ? value.wordWrap : defaults.wordWrap,
          fontSize: Number.isInteger(value.fontSize) && value.fontSize >= 12 && value.fontSize <= 24 ? value.fontSize : defaults.fontSize,
        });
      }
    } catch { /* Corrupt or inaccessible preferences do not prevent editing. */ }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(key, JSON.stringify(preferences));
      setUnavailable(false);
    } catch { setUnavailable(true); }
  }, [loaded, preferences]);
  return { preferences, setPreferences, unavailable };
}
