"use client";
import dynamic from "next/dynamic";
import { Component, useRef, useState, type ReactNode } from "react";
import { PlainPythonEditor } from "./plain-python-editor";
import { useEditorPreferences } from "./use-editor-preferences";

const PythonEditor = dynamic(() => import("./python-editor"), {
  ssr: false,
  loading: () => <p role="status">Loading editor… You can switch to plain text below.</p>,
});

class EditorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export function SolutionEditor({ value, onChange, readOnly, starter }: {
  value: string; onChange: (value: string) => void; readOnly: boolean; starter?: string;
}) {
  const { preferences: { plain, wordWrap, fontSize }, setPreferences, unavailable } = useEditorPreferences();
  const setPlain = (update: (value: boolean) => boolean) => setPreferences(current => ({ ...current, plain: update(current.plain) }));
  const setWordWrap = (update: (value: boolean) => boolean) => setPreferences(current => ({ ...current, wordWrap: update(current.wordWrap) }));
  const setFontSize = (update: number | ((value: number) => number)) => setPreferences(current => ({ ...current, fontSize: typeof update === "number" ? update : update(current.fontSize) }));
  const [downloadError, setDownloadError] = useState(false);
  const copying = useRef(false);
  const [copyPending, setCopyPending] = useState(false);
  const [copyResult, setCopyResult] = useState<{ value: string; ok: boolean } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const canReset = !readOnly && starter !== undefined && value !== starter;
  async function copySolution() {
    if (copying.current) return;
    copying.current = true;
    setCopyPending(true);
    setCopyResult(null);
    try {
      await navigator.clipboard.writeText(value);
      setCopyResult({ value, ok: true });
    } catch {
      setCopyResult({ value, ok: false });
    } finally {
      copying.current = false;
      setCopyPending(false);
    }
  }
  function downloadSolution() {
    setDownloadError(false);
    let url: string | undefined;
    const link = document.createElement("a");
    try {
      url = URL.createObjectURL(new Blob([value], { type: "text/x-python;charset=utf-8" }));
      link.href = url;
      link.download = "solution.py";
      document.body.appendChild(link);
      link.click();
    } catch {
      setDownloadError(true);
    } finally {
      link.remove();
      // Give the browser time to begin reading the download before releasing it.
      if (url) {
        const downloadUrl = url;
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      }
    }
  }
  const textEditor = <PlainPythonEditor value={value} onChange={onChange} readOnly={readOnly} fontSize={fontSize} wordWrap={wordWrap}/>;
  return <div className="solution-editor">
    {unavailable && <p role="status">Editor preferences apply for this visit. Browser storage is unavailable, so they may reset next time.</p>}
    <div className="solution-editor-actions" role="group" aria-label="Solution text size">
      <button type="button" className="button button--secondary" aria-label="Decrease solution text size" disabled={fontSize <= 12} onClick={() => setFontSize(size => Math.max(12, size - 1))}>A-</button>
      <span aria-live="polite" aria-atomic="true">{fontSize}px</span>
      <button type="button" className="button button--secondary" aria-label="Increase solution text size" disabled={fontSize >= 24} onClick={() => setFontSize(size => Math.min(24, size + 1))}>A+</button>
      <button type="button" className="button button--secondary" disabled={fontSize === 15} onClick={() => setFontSize(15)}>Reset text size</button>
    </div>
    <div className="solution-editor-actions"><button type="button" className="button button--secondary" aria-pressed={wordWrap} onClick={() => setWordWrap(current => !current)}>Wrap long lines</button></div>
    {plain ? textEditor : <EditorBoundary fallback={<><p role="status">Advanced editor unavailable. Continue in plain text; your code is preserved.</p>{textEditor}</>}>
      <PythonEditor value={value} onChange={onChange} readOnly={readOnly} fontSize={fontSize} wordWrap={wordWrap}/>
    </EditorBoundary>}
    <div className="solution-editor-actions"><button type="button" className="button button--secondary" aria-pressed={plain} onClick={() => setPlain(current => !current)}>
      {plain ? "Use advanced editor" : "Use plain text editor"}
    </button>
    <button type="button" className="button button--secondary" onClick={downloadSolution}>Download solution (.py)</button>
    <button type="button" className="button button--secondary" disabled={copyPending} onClick={copySolution}>{copyPending ? "Copying solution…" : "Copy solution"}</button>
    {starter !== undefined && !readOnly && <button type="button" className="button button--secondary" disabled={!canReset} onClick={() => setConfirmReset(true)}>Reset to starter code</button>}</div>
    {confirmReset && canReset && <div className="card" role="group" aria-label="Confirm solution reset">
      <p>Replace your current solution with the starter code? Download your solution first if you want to keep it.</p>
      <div className="solution-editor-actions">
        <button type="button" className="button button--secondary" onClick={() => setConfirmReset(false)}>Keep my solution</button>
        <button type="button" className="button button--primary" onClick={() => { if (canReset) onChange(starter); setConfirmReset(false); }}>Replace with starter code</button>
      </div>
    </div>}
    {downloadError && <p role="alert">Unable to download your solution. Try again or copy your code to a local file.</p>}
    {copyResult?.value === value && (copyResult.ok
      ? <p role="status">Solution copied to clipboard.</p>
      : <p role="alert">Unable to copy your solution. Try again, download it or select and copy the code manually.</p>)}
  </div>;
}
