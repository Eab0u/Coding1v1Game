"use client";
import { useId, useLayoutEffect, useRef } from "react";

export function PlainPythonEditor({ value, onChange, readOnly }: {
  value: string; onChange: (value: string) => void; readOnly: boolean;
}) {
  const input = useRef<HTMLTextAreaElement>(null);
  const caret = useRef<number | null>(null);
  const hint = useId();
  useLayoutEffect(() => {
    if (caret.current !== null) {
      input.current?.setSelectionRange(caret.current, caret.current);
      caret.current = null;
    }
  }, [value]);
  return <>
    <textarea ref={input} className="plain-solution-editor" aria-label="Python solution" aria-describedby={hint} value={value}
      onChange={event => onChange(event.target.value)} readOnly={readOnly} spellCheck={false}
      autoCapitalize="off" autoCorrect="off" wrap="off"
      onKeyDown={event => {
        if (readOnly || event.key !== "Enter" || event.nativeEvent.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
        const { selectionStart: start, selectionEnd: end } = event.currentTarget;
        const prefix = value.slice(value.slice(0, start).lastIndexOf("\n") + 1, start);
        const indent = prefix.match(/^[\t ]*/)?.[0] ?? "";
        const insertion = "\n" + indent + (prefix.trimEnd().endsWith(":") ? "    " : "");
        event.preventDefault();
        caret.current = start + insertion.length;
        onChange(value.slice(0, start) + insertion + value.slice(end));
      }} />
    <p id={hint} className="editor-hint">Enter keeps indentation and adds four spaces after a colon. Shift+Enter inserts a plain newline. Tab moves to the next control.</p>
  </>;
}
