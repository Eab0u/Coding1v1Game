"use client";
import dynamic from "next/dynamic";
import { Component, useState, type ReactNode } from "react";
import { PlainPythonEditor } from "./plain-python-editor";

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
  const [plain, setPlain] = useState(false);
  const [fontSize, setFontSize] = useState(15);
  const [downloadError, setDownloadError] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const canReset = !readOnly && starter !== undefined && value !== starter;
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
  const textEditor = <PlainPythonEditor value={value} onChange={onChange} readOnly={readOnly} fontSize={fontSize}/>;
  return <div className="solution-editor">
    <div className="solution-editor-actions" role="group" aria-label="Solution text size">
      <button type="button" className="button button--secondary" aria-label="Decrease solution text size" disabled={fontSize <= 12} onClick={() => setFontSize(size => Math.max(12, size - 1))}>A-</button>
      <span aria-live="polite" aria-atomic="true">{fontSize}px</span>
      <button type="button" className="button button--secondary" aria-label="Increase solution text size" disabled={fontSize >= 24} onClick={() => setFontSize(size => Math.min(24, size + 1))}>A+</button>
      <button type="button" className="button button--secondary" disabled={fontSize === 15} onClick={() => setFontSize(15)}>Reset text size</button>
    </div>
    {plain ? textEditor : <EditorBoundary fallback={<><p role="status">Advanced editor unavailable. Continue in plain text; your code is preserved.</p>{textEditor}</>}>
      <PythonEditor value={value} onChange={onChange} readOnly={readOnly} fontSize={fontSize}/>
    </EditorBoundary>}
    <div className="solution-editor-actions"><button type="button" className="button button--secondary" aria-pressed={plain} onClick={() => setPlain(current => !current)}>
      {plain ? "Use advanced editor" : "Use plain text editor"}
    </button>
    <button type="button" className="button button--secondary" onClick={downloadSolution}>Download solution (.py)</button>
    {starter !== undefined && !readOnly && <button type="button" className="button button--secondary" disabled={!canReset} onClick={() => setConfirmReset(true)}>Reset to starter code</button>}</div>
    {confirmReset && canReset && <div className="card" role="group" aria-label="Confirm solution reset">
      <p>Replace your current solution with the starter code? Download your solution first if you want to keep it.</p>
      <div className="solution-editor-actions">
        <button type="button" className="button button--secondary" onClick={() => setConfirmReset(false)}>Keep my solution</button>
        <button type="button" className="button button--primary" onClick={() => { if (canReset) onChange(starter); setConfirmReset(false); }}>Replace with starter code</button>
      </div>
    </div>}
    {downloadError && <p role="alert">Unable to download your solution. Try again or copy your code to a local file.</p>}
  </div>;
}
