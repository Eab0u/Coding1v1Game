"use client";
import dynamic from "next/dynamic";
import { Component, useId, useRef, useState, type ReactNode } from "react";
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
  const [downloadResult, setDownloadResult] = useState<{ revision: number; ok: boolean } | null>(null);
  const [editorAttempt, setEditorAttempt] = useState(0);
  const copying = useRef(false);
  const [draftVersion, setDraftVersion] = useState({ value, revision: 0 });
  if (draftVersion.value !== value) {
    setDraftVersion({ value, revision: draftVersion.revision + 1 });
  }
  const [copyPending, setCopyPending] = useState(false);
  const [copyResult, setCopyResult] = useState<{ revision: number; ok: boolean } | null>(null);
  const [resetRequest, setResetRequest] = useState<{ value: string; starter: string } | null>(null);
  const resetGuidanceId = useId();
  const recoveryGuidanceId = useId();
  const copyGuidanceId = useId();
  const downloadGuidanceId = useId();
  const copyResultId = useId();
  const hasCopyResult = copyResult?.revision === draftVersion.revision;
  const hasDownloadResult = downloadResult?.revision === draftVersion.revision;
  const resetButton = useRef<HTMLButtonElement>(null);
  const editorGroup = useRef<HTMLDivElement>(null);
  function cancelReset() {
    setResetRequest(null);
    resetButton.current?.focus();
  }
  const canReset = !readOnly && starter !== undefined && value !== starter;
  const confirmReset = resetRequest !== null && canReset && resetRequest.value === value && resetRequest.starter === starter;
  // Invalidate the request permanently, even if the previous draft later returns.
  if (resetRequest !== null && !confirmReset) setResetRequest(null);
  async function copySolution() {
    if (copying.current) return;
    const revision = draftVersion.revision;
    copying.current = true;
    setCopyPending(true);
    setCopyResult(null);
    try {
      await navigator.clipboard.writeText(value);
      setCopyResult({ revision, ok: true });
    } catch {
      setCopyResult({ revision, ok: false });
    } finally {
      copying.current = false;
      setCopyPending(false);
    }
  }
  function downloadSolution() {
    setDownloadResult(null);
    let url: string | undefined;
    const link = document.createElement("a");
    try {
      url = URL.createObjectURL(new Blob([value], { type: "text/x-python;charset=utf-8" }));
      link.href = url;
      link.download = "solution.py";
      document.body.appendChild(link);
      link.click();
      setDownloadResult({ revision: draftVersion.revision, ok: true });
    } catch {
      setDownloadResult({ revision: draftVersion.revision, ok: false });
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
  return <div ref={editorGroup} className="solution-editor" role="group" aria-label="Solution editor" tabIndex={-1}>
    {unavailable && <p role="status">Editor preferences apply for this visit. Browser storage is unavailable, so they may reset next time.</p>}
    <div className="solution-editor-actions" role="group" aria-label="Solution text size">
      <button type="button" className="button button--secondary" aria-label="Decrease solution text size" disabled={fontSize <= 12} onClick={() => setFontSize(size => Math.max(12, size - 1))}>A-</button>
      <span aria-live="polite" aria-atomic="true">{fontSize}px</span>
      <button type="button" className="button button--secondary" aria-label="Increase solution text size" disabled={fontSize >= 24} onClick={() => setFontSize(size => Math.min(24, size + 1))}>A+</button>
      <button type="button" className="button button--secondary" disabled={fontSize === 15} onClick={() => setFontSize(15)}>Reset text size</button>
    </div>
    <div className="solution-editor-actions"><button type="button" className="button button--secondary" aria-pressed={wordWrap} onClick={() => setWordWrap(current => !current)}>Wrap long lines</button></div>
    {plain ? textEditor : <EditorBoundary key={editorAttempt} fallback={<><p id={recoveryGuidanceId} className="solution-editor-recovery" role="status" aria-atomic="true">Advanced editor unavailable. Continue in plain text; your code is preserved. Retry loads the advanced editor again using your current solution and preferences.</p>{textEditor}<div className="solution-editor-actions"><button type="button" className="button button--secondary" aria-describedby={recoveryGuidanceId} onClick={() => { editorGroup.current?.focus(); setEditorAttempt(attempt => attempt + 1); }}>Retry advanced editor</button></div></>}>
      <PythonEditor value={value} onChange={onChange} readOnly={readOnly} fontSize={fontSize} wordWrap={wordWrap}/>
    </EditorBoundary>}
    <div className="solution-editor-actions"><button type="button" className="button button--secondary" aria-pressed={plain} onClick={() => setPlain(current => !current)}>
      {plain ? "Use advanced editor" : "Use plain text editor"}
    </button>
    <button type="button" className="button button--secondary" aria-describedby={hasDownloadResult ? downloadGuidanceId : undefined} onClick={downloadSolution}>Download solution (.py)</button>
    <button type="button" className="button button--secondary" aria-disabled={copyPending} aria-busy={copyPending} aria-describedby={copyPending ? copyGuidanceId : hasCopyResult ? copyResultId : undefined} onClick={copySolution}>{copyPending ? "Copying solution…" : "Copy solution"}</button>
    {starter !== undefined && !readOnly && <button ref={resetButton} type="button" className="button button--secondary" disabled={!canReset} onClick={() => { if (canReset) setResetRequest({ value, starter }); }}>Reset to starter code</button>}</div>
    {confirmReset && canReset && <div className="card" role="group" aria-label="Confirm solution reset" aria-describedby={resetGuidanceId} onKeyDown={event => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      cancelReset();
    }}>
      <p id={resetGuidanceId}>Replace your current solution with the starter code? Editing your solution dismisses this confirmation. Download your solution first if you want to keep it.</p>
      <div className="solution-editor-actions">
        <button autoFocus aria-describedby={resetGuidanceId} type="button" className="button button--secondary" onClick={cancelReset}>Keep my solution</button>
        <button type="button" className="button button--primary" aria-describedby={resetGuidanceId} onClick={() => { if (canReset) onChange(starter); setResetRequest(null); editorGroup.current?.focus(); }}>Replace with starter code</button>
      </div>
    </div>}
    {copyPending && <p id={copyGuidanceId} role="status" aria-atomic="true">Copying the solution captured when you clicked Copy. Your browser may ask for clipboard permission. You can keep editing.</p>}
    {hasDownloadResult && (downloadResult.ok
      ? <p id={downloadGuidanceId} className="solution-download-notice" role="status" aria-atomic="true">Download requested. Check your browser downloads for solution.py; your browser may ask where to save it.</p>
      : <p id={downloadGuidanceId} className="solution-download-notice solution-download-notice--error" role="alert">Unable to download your solution. Try again or copy your code to a local file.</p>)}
    {hasCopyResult && (copyResult.ok
      ? <p id={copyResultId} className="solution-copy-notice" role="status" aria-atomic="true">Solution copied to clipboard.</p>
      : <p id={copyResultId} className="solution-copy-notice solution-copy-notice--error" role="alert">Unable to copy your solution. Try again, download it or select and copy the code manually.</p>)}
  </div>;
}
