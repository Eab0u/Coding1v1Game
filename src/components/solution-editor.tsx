"use client";
import dynamic from "next/dynamic";
import { Component, useEffect, useId, useRef, useState, type ReactNode } from "react";
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
  const { preferences: { plain, wordWrap, fontSize }, setPreferences, unavailable, retrySaving } = useEditorPreferences();
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
  const [copyRevision, setCopyRevision] = useState<number | null>(null);
  const copyPending = copyRevision !== null;
  const [copyDelayed, setCopyDelayed] = useState(false);
  const copyStartedAt = useRef(0);
  useEffect(() => {
    if (!copyPending) return;
    const refresh = () => {
      if (Date.now() - copyStartedAt.current >= 10_000) setCopyDelayed(true);
    };
    const timer = window.setTimeout(() => setCopyDelayed(true), 10_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [copyPending]);
  const [copyResult, setCopyResult] = useState<{ revision: number; ok: boolean } | null>(null);
  const [resetRequest, setResetRequest] = useState<{ value: string; starter: string } | null>(null);
  const preferenceGuidanceId = useId();
  const preferenceDescription = unavailable ? preferenceGuidanceId : undefined;
  const resetGuidanceId = useId();
  const resetConfirmationId = useId();
  const resetAvailabilityId = useId();
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
    copyStartedAt.current = Date.now();
    setCopyDelayed(false);
    setCopyRevision(revision);
    setCopyResult(null);
    try {
      await navigator.clipboard.writeText(value);
      setCopyResult({ revision, ok: true });
    } catch {
      setCopyResult({ revision, ok: false });
    } finally {
      copying.current = false;
      setCopyRevision(null);
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
  return <div ref={editorGroup} className="solution-editor" role="group" aria-label="Solution editor" tabIndex={-1} onKeyDownCapture={event => {
    if (!confirmReset || event.key !== "Escape" || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
    event.preventDefault();
    event.stopPropagation();
    cancelReset();
  }}>
    {unavailable && <p id={preferenceGuidanceId} className="solution-editor-recovery" role="status" aria-atomic="true">Editor preferences apply for this visit. Browser storage is unavailable, so they may reset next time. Changing text size, line wrapping or editor mode retries saving your preferences; your solution stays in the editor. Retry saving preferences keeps your current settings.</p>}
    {unavailable && <div className="solution-editor-actions"><button type="button" className="button button--secondary" aria-describedby={preferenceGuidanceId} onClick={event => {
      const focused = document.activeElement === event.currentTarget;
      if (retrySaving() && focused) editorGroup.current?.focus();
    }}>Retry saving preferences</button></div>}
    <div className="solution-editor-actions" role="group" aria-label="Solution text size">
      <button type="button" className="button button--secondary" aria-describedby={preferenceDescription} aria-label="Decrease solution text size" aria-disabled={fontSize <= 12} onClick={() => { if (fontSize > 12) setFontSize(size => Math.max(12, size - 1)); }}>A-</button>
      <span aria-live="polite" aria-atomic="true">{fontSize}px</span>
      <button type="button" className="button button--secondary" aria-describedby={preferenceDescription} aria-label="Increase solution text size" aria-disabled={fontSize >= 24} onClick={() => { if (fontSize < 24) setFontSize(size => Math.min(24, size + 1)); }}>A+</button>
      <button type="button" className="button button--secondary" aria-describedby={preferenceDescription} aria-disabled={fontSize === 15} onClick={() => { if (fontSize !== 15) setFontSize(15); }}>Reset text size</button>
    </div>
    <div className="solution-editor-actions"><button type="button" className="button button--secondary" aria-describedby={preferenceDescription} aria-pressed={wordWrap} onClick={() => setWordWrap(current => !current)}>Wrap long lines</button></div>
    {plain ? textEditor : <EditorBoundary key={editorAttempt} fallback={<><p id={recoveryGuidanceId} className="solution-editor-recovery" role="status" aria-atomic="true">Advanced editor unavailable. Continue in plain text; your code is preserved. Retry loads the advanced editor again using your current solution and preferences.</p>{textEditor}<div className="solution-editor-actions"><button type="button" className="button button--secondary" aria-describedby={recoveryGuidanceId} onClick={() => { editorGroup.current?.focus(); setEditorAttempt(attempt => attempt + 1); }}>Retry advanced editor</button></div></>}>
      <PythonEditor value={value} onChange={onChange} readOnly={readOnly} fontSize={fontSize} wordWrap={wordWrap}/>
    </EditorBoundary>}
    <div className="solution-editor-actions"><button type="button" className="button button--secondary" aria-describedby={preferenceDescription} aria-pressed={plain} onClick={() => setPlain(current => !current)}>
      {plain ? "Use advanced editor" : "Use plain text editor"}
    </button>
    <button type="button" className="button button--secondary" aria-describedby={hasDownloadResult ? downloadGuidanceId : undefined} onClick={downloadSolution}>Download solution (.py)</button>
    <button type="button" className="button button--secondary" aria-disabled={copyPending} aria-busy={copyPending} aria-describedby={copyPending ? copyGuidanceId : hasCopyResult ? copyResultId : undefined} onClick={copySolution}>{copyPending ? "Copying solution…" : "Copy solution"}</button>
    {starter !== undefined && !readOnly && <button ref={resetButton} aria-expanded={confirmReset} aria-controls={confirmReset ? resetConfirmationId : undefined} type="button" className="button button--secondary" aria-disabled={!canReset} aria-describedby={!canReset ? resetAvailabilityId : undefined} onClick={() => { if (canReset) setResetRequest({ value, starter }); }}>Reset to starter code</button>}</div>
    {starter !== undefined && !readOnly && !canReset && <p id={resetAvailabilityId} className="solution-reset-notice">Your solution already matches the starter code. Reset becomes available after you edit it.</p>}
    {confirmReset && canReset && <div id={resetConfirmationId} className="card solution-reset-confirmation" role="group" aria-label="Confirm solution reset" aria-describedby={resetGuidanceId}>
      <h3>Replace your solution?</h3>
      <p id={resetGuidanceId}>Replace your current solution with the starter code? Editing your solution dismisses this confirmation. Press Escape anywhere in this editor to keep your solution. Download your solution first if you want to keep it.</p>
      <div className="solution-editor-actions">
        <button autoFocus aria-describedby={resetGuidanceId} type="button" className="button button--secondary" onClick={cancelReset}>Keep my solution</button>
        <button type="button" className="button solution-reset-replace" aria-describedby={resetGuidanceId} onClick={() => { if (canReset) onChange(starter); setResetRequest(null); editorGroup.current?.focus(); }}>Replace with starter code</button>
      </div>
    </div>}
    {copyPending && <p id={copyGuidanceId} className="solution-copy-notice solution-copy-notice--pending" role="status" aria-atomic="true">Copying the solution captured when you clicked Copy. Your browser may ask for clipboard permission. You can keep editing.{copyDelayed && <><strong className="solution-copy-delay-heading">Clipboard request still waiting.</strong> Check your browser for a clipboard permission prompt. You can download your solution or select and copy the code manually while waiting. Completing this request later can replace other text on your clipboard.</>}{copyRevision !== draftVersion.revision && " Your solution has changed since this copy started. This request contains the earlier draft. Copy again after it finishes to copy your current solution."}</p>}
    {hasDownloadResult && (downloadResult.ok
      ? <p id={downloadGuidanceId} className="solution-download-notice" role="status" aria-atomic="true">Download requested. Check your browser downloads for solution.py; your browser may ask where to save it.</p>
      : <p id={downloadGuidanceId} className="solution-download-notice solution-download-notice--error" role="alert"><strong className="solution-export-error-heading" role="heading" aria-level={3}>Unable to download your solution.</strong>{" "}Try again or copy your code to a local file.</p>)}
    {hasCopyResult && (copyResult.ok
      ? <p id={copyResultId} className="solution-copy-notice" role="status" aria-atomic="true">Solution copied to clipboard.</p>
      : <p id={copyResultId} className="solution-copy-notice solution-copy-notice--error" role="alert"><strong className="solution-export-error-heading" role="heading" aria-level={3}>Unable to copy your solution.</strong>{" "}Try again, download it or select and copy the code manually.</p>)}
  </div>;
}
