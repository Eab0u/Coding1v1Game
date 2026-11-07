"use client";

import { useEffect, useRef } from "react";

// Reset precedes value restoration and can be cancelled by another listener.
export function useFieldReset(onReset: (input: HTMLInputElement) => void) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const input = ref.current;
    const form = input?.form;
    if (!input || !form) return;
    let mounted = true;
    const reset = (event: Event) => queueMicrotask(() => {
      if (mounted && !event.defaultPrevented) onReset(input);
    });
    form.addEventListener("reset", reset);
    return () => {
      mounted = false;
      form.removeEventListener("reset", reset);
    };
  }, [onReset]);
  return ref;
}
