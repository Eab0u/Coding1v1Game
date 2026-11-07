"use client";
import { useId, useLayoutEffect, useRef } from "react";

// Retain string and delimiter context from earlier lines when checking a header.
function pythonLineContext(line: string) {
  let quote = "";
  let escaped = false;
  let code = "";
  let mismatched = false;
  const brackets: string[] = [];
  for (let index = 0; index < line.length; index++) {
    const character = line[index];
    // Ordinary strings cannot cross an unescaped physical newline. Recover
    // after an incomplete earlier line while retaining triple/continued strings.
    if (quote.length === 1 && character === "\n" && !escaped) quote = "";
    if (quote) {
      code += character;
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (line.startsWith(quote, index)) {
        index += quote.length - 1;
        quote = "";
      }
    } else {
      // Python joins a backslash immediately followed by a newline outside strings.
      if (character === "\\" && line[index + 1] === "\n") {
        code += " ";
        index++;
        continue;
      }
      if (character === "#") {
        const newline = line.indexOf("\n", index);
        if (newline < 0) break;
        index = newline - 1;
        continue;
      }
      if (character === "\n") {
        code = brackets.length ? code + " " : "";
        if (!brackets.length) mismatched = false;
        continue;
      }
      code += character;
      if (character === "'" || character === '"') {
        quote = line.startsWith(character.repeat(3), index) ? character.repeat(3) : character;
        code += quote.slice(1);
        index += quote.length - 1;
      }
      else if ("([{".includes(character)) brackets.push(character);
      else if (")]}".includes(character)) {
        const opening = { ")": "(", "]": "[", "}": "{" }[character];
        if (brackets.pop() !== opening) mismatched = true;
      }
    }
  }
  const header = code.trim();
  const isHeader = !mismatched && !quote && brackets.length === 0 && header.endsWith(":") &&
    /^(?:(?:async\s+)?(?:def|for|with)\b|(?:if|elif|else|while|try|except|finally|class|match|case)\b)/.test(header);
  return { headerIndent: isHeader ? (code.match(/^[\t ]*/)?.[0] ?? "") : null, inString: Boolean(quote) };
}

export function PlainPythonEditor({ value, onChange, readOnly, fontSize = 15, wordWrap = false }: {
  value: string; onChange: (value: string) => void; readOnly: boolean; fontSize?: number; wordWrap?: boolean;
}) {
  const input = useRef<HTMLTextAreaElement>(null);
  const composing = useRef(false);
  const caret = useRef<[number, number, ("forward" | "backward" | "none")?] | null>(null);
  const position = useRef<HTMLDivElement>(null);
  const hint = useId();
  const positionId = useId();
  const summaryId = useId();
  const lineCount = value.split("\n").length;
  function updatePosition() {
    const editor = input.current;
    if (!editor || !position.current) return;
    const { selectionStart: start, selectionEnd: end, selectionDirection } = editor;
    const active = selectionDirection === "backward" ? start : end;
    const before = editor.value.slice(0, active);
    const line = before.split("\n").length;
    const column = active - before.lastIndexOf("\n");
    const selected = end - start;
    // Match block indentation: ending at the next line start excludes that line.
    const selectionStop = end > start && editor.value[end - 1] === "\n" ? end - 1 : end;
    const selectedLines = editor.value.slice(start, selectionStop).split("\n").length;
    position.current.textContent = `Line ${line}, column ${column}${selected ? ` · ${selected} code unit${selected === 1 ? "" : "s"} selected across ${selectedLines} line${selectedLines === 1 ? "" : "s"}` : ""}`;
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
    if (!editor || readOnly || composing.current) return;
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
    {readOnly && <p className="editor-readonly-notice" role="note" aria-label="Read-only solution">Read-only solution. You can select and copy your code.</p>}
    <div className="solution-editor-actions" role="group" aria-label="Python indentation">
      <button type="button" className="button button--secondary" disabled={readOnly} onMouseDown={event => {
        if (composing.current) event.preventDefault();
      }} onClick={() => changeIndent(false)}>Indent</button>
      <button type="button" className="button button--secondary" disabled={readOnly} onMouseDown={event => {
        if (composing.current) event.preventDefault();
      }} onClick={() => changeIndent(true)}>Outdent</button>
    </div>
    <div className="solution-editor-actions"><button type="button" className="button button--secondary" onMouseDown={event => {
      // Keep pointer activation from blurring the textarea before the click guard.
      if (composing.current) event.preventDefault();
    }} onClick={() => {
      const editor = input.current;
      if (!editor || composing.current) return;
      editor.focus();
      editor.setSelectionRange(0, editor.value.length, "forward");
      updatePosition();
    }}>Select all code</button></div>
    <p id={summaryId} className="editor-position" aria-label="Solution size">{lineCount} {lineCount === 1 ? "line" : "lines"} · {value.length} UTF-16 code {value.length === 1 ? "unit" : "units"}. An empty draft has one line; a trailing newline starts another.</p>
    <textarea ref={input} style={{ fontSize, whiteSpace: wordWrap ? "pre-wrap" : "pre", overflowWrap: wordWrap ? "anywhere" : "normal" }} className="plain-solution-editor" aria-label="Python solution" aria-describedby={`${hint} ${positionId} ${summaryId}`} value={value}
      onSelect={updatePosition} onFocus={updatePosition} onKeyUp={updatePosition} onPointerUp={updatePosition}
      onCompositionStart={() => { composing.current = true; }}
      onCompositionEnd={() => { composing.current = false; }}
      onBlur={() => { composing.current = false; }}
      onChange={event => { updatePosition(); onChange(event.target.value); }} readOnly={readOnly} spellCheck={false}
      autoCapitalize="off" autoCorrect="off" wrap={wordWrap ? "soft" : "off"}
      onKeyDown={event => {
        if (readOnly || composing.current || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
        if (event.key === "Backspace" && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
          const { selectionStart: start, selectionEnd: end } = event.currentTarget;
          const prefix = value.slice(value.slice(0, start).lastIndexOf("\n") + 1, start);
          if (start === end && /^ +$/.test(prefix) && !pythonLineContext(value.slice(0, start)).inString) {
            const removed = ((prefix.length - 1) % 4) + 1;
            event.preventDefault();
            caret.current = [start - removed, start - removed];
            onChange(value.slice(0, start - removed) + value.slice(end));
          }
          return;
        }
        if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && (event.key === "[" || event.key === "]")) {
          event.preventDefault();
          changeIndent(event.key === "[");
          return;
        }
        if (event.key !== "Enter" || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
        const { selectionStart: start, selectionEnd: end } = event.currentTarget;
        const prefix = value.slice(value.slice(0, start).lastIndexOf("\n") + 1, start);
        const indent = prefix.match(/^[\t ]*/)?.[0] ?? "";
        const { headerIndent } = pythonLineContext(value.slice(0, start));
        const insertion = "\n" + (headerIndent === null ? indent : headerIndent + "    ");
        event.preventDefault();
        caret.current = [start + insertion.length, start + insertion.length];
        onChange(value.slice(0, start) + insertion + value.slice(end));
      }} />
    <div ref={position} id={positionId} className="editor-position" role="group" aria-label="Solution cursor position" aria-live="off">Line 1, column 1</div>
    <p id={hint} className="editor-hint">{readOnly
      ? "This solution is read-only. Select text and use Ctrl+C or Cmd+C to copy it. Tab moves to the next control. Use Select all code to focus and select the whole solution for copying."
      : "Enter keeps indentation and adds four spaces from the opening line of a Python block header, ignoring trailing comments and colons inside unfinished strings or brackets, including context from earlier lines and backslash continuations. Backspace in space-only leading indentation outside strings removes spaces to the previous four-space stop. Shift+Enter inserts a plain newline. Tab moves to the next control. Ctrl+] or Cmd+] indents; Ctrl+[ or Cmd+[ outdents. Indent and Outdent adjust the current line or selected lines by four spaces (or remove one leading tab). Use Select all code to focus and select the whole solution for copying."}</p>
  </>;
}
