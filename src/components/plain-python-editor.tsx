"use client";
import { useId, useLayoutEffect, useRef } from "react";

export function PlainPythonEditor({ value, onChange, readOnly, fontSize = 15, wordWrap = false }: {
  value: string; onChange: (value: string) => void; readOnly: boolean; fontSize?: number; wordWrap?: boolean;
}) {
  const input = useRef<HTMLTextAreaElement>(null);
  const caret = useRef<[number, number, ("forward" | "backward" | "none")?] | null>(null);
  const position = useRef<HTMLDivElement>(null);
  const hint = useId();
  const positionId = useId();
  function updatePosition() {
    const editor = input.current;
    if (!editor || !position.current) return;
    const { selectionStart: start, selectionEnd: end, selectionDirection } = editor;
    const active = selectionDirection === "backward" ? start : end;
    const before = editor.value.slice(0, active);
    const line = before.split("\n").length;
    const column = active - before.lastIndexOf("\n");
    const selected = end - start;
    position.current.textContent = `Line ${line}, column ${column}${selected ? ` · ${selected} code unit${selected === 1 ? "" : "s"} selected` : ""}`;
  }
  useLayoutEffect(() => {
    if (caret.current !== null) {
      input.current?.setSelectionRange(...caret.current);
      caret.current = null;
    }
    updatePosition();
  }, [value]);
  function changeIndent(outdent: boolean) {
    const editor = input.current;
    if (!editor || readOnly) return;
    const { selectionStart: start, selectionEnd: end, selectionDirection } = editor;
    const first = value.slice(0, start).lastIndexOf("\n") + 1;
    // A selection ending at the next line's start does not include that line.
    const last = end > start && value[end - 1] === "\n" ? end - 1 : end;
    const lineEnd = value.indexOf("\n", last);
    const stop = lineEnd < 0 ? value.length : lineEnd;
    let offset = first;
    let nextStart = start;
    let nextEnd = end;
    const block = value.slice(first, stop).split("\n").map(line => {
      const removed = outdent ? (line.startsWith("\t") ? 1 : (line.match(/^ {0,4}/)?.[0].length ?? 0)) : 0;
      const added = outdent ? 0 : 4;
      const adjust = (position: number) => position + added - Math.min(removed, Math.max(0, position - offset));
      if (start >= offset) nextStart += adjust(start) - start;
      if (end >= offset) nextEnd += adjust(end) - end;
      offset += line.length + 1;
      return outdent ? line.slice(removed) : "    " + line;
    }).join("\n");
    editor.focus();
    if (block === value.slice(first, stop)) return;
    caret.current = [nextStart, nextEnd, selectionDirection];
    onChange(value.slice(0, first) + block + value.slice(stop));
  }
  return <>
    <div className="solution-editor-actions" role="group" aria-label="Python indentation">
      <button type="button" className="button button--secondary" disabled={readOnly} onClick={() => changeIndent(false)}>Indent</button>
      <button type="button" className="button button--secondary" disabled={readOnly} onClick={() => changeIndent(true)}>Outdent</button>
    </div>
    <textarea ref={input} style={{ fontSize, whiteSpace: wordWrap ? "pre-wrap" : "pre", overflowWrap: wordWrap ? "anywhere" : "normal" }} className="plain-solution-editor" aria-label="Python solution" aria-describedby={`${hint} ${positionId}`} value={value}
      onSelect={updatePosition} onFocus={updatePosition} onKeyUp={updatePosition} onPointerUp={updatePosition}
      onChange={event => { updatePosition(); onChange(event.target.value); }} readOnly={readOnly} spellCheck={false}
      autoCapitalize="off" autoCorrect="off" wrap={wordWrap ? "soft" : "off"}
      onKeyDown={event => {
        if (readOnly || event.key !== "Enter" || event.nativeEvent.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
        const { selectionStart: start, selectionEnd: end } = event.currentTarget;
        const prefix = value.slice(value.slice(0, start).lastIndexOf("\n") + 1, start);
        const indent = prefix.match(/^[\t ]*/)?.[0] ?? "";
        const insertion = "\n" + indent + (prefix.trimEnd().endsWith(":") ? "    " : "");
        event.preventDefault();
        caret.current = [start + insertion.length, start + insertion.length];
        onChange(value.slice(0, start) + insertion + value.slice(end));
      }} />
    <div ref={position} id={positionId} className="editor-position" role="group" aria-label="Solution cursor position" aria-live="off">Line 1, column 1</div>
    <p id={hint} className="editor-hint">Enter keeps indentation and adds four spaces after a colon. Shift+Enter inserts a plain newline. Tab moves to the next control. Indent and Outdent adjust the current line or selected lines by four spaces (or remove one leading tab).</p>
  </>;
}
