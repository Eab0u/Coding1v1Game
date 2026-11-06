"use client";
import dynamic from "next/dynamic";
import { Component, useState, type ReactNode } from "react";

const PythonEditor = dynamic(() => import("./python-editor"), {
  ssr: false,
  loading: () => <p role="status">Loading editor… You can switch to plain text below.</p>,
});

class EditorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export function SolutionEditor({ value, onChange, readOnly }: {
  value: string; onChange: (value: string) => void; readOnly: boolean;
}) {
  const [plain, setPlain] = useState(false);
  const textEditor = <textarea className="plain-solution-editor" aria-label="Python solution" value={value}
    onChange={event => onChange(event.target.value)} readOnly={readOnly} spellCheck={false}
    autoCapitalize="off" autoCorrect="off" wrap="off" />;
  return <div className="solution-editor">
    {plain ? textEditor : <EditorBoundary fallback={<><p role="status">Advanced editor unavailable. Continue in plain text; your code is preserved.</p>{textEditor}</>}>
      <PythonEditor value={value} onChange={onChange} readOnly={readOnly}/>
    </EditorBoundary>}
    <button type="button" className="button button--secondary" aria-pressed={plain} onClick={() => setPlain(current => !current)}>
      {plain ? "Use advanced editor" : "Use plain text editor"}
    </button>
  </div>;
}
