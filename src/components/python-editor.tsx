"use client";
import Editor, { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
loader.config({ monaco });
export default function PythonEditor({value,onChange,readOnly,fontSize=15,wordWrap=false}:{value:string;onChange:(value:string)=>void;readOnly:boolean;fontSize?:number;wordWrap?:boolean}) {
  return <>{readOnly && <p className="editor-readonly-notice" role="note" aria-label="Read-only solution">Read-only solution. You can select and copy your code.</p>}
    <p className="editor-hint">{readOnly
      ? "Tab and Shift+Tab move between controls. Select text and use Ctrl+C or Cmd+C to copy it. You can also use Copy solution or Download solution below to keep your code."
      : "Tab and Shift+Tab move between controls. To indent code, use Ctrl+] or Cmd+]; to outdent, use Ctrl+[ or Cmd+[."}</p>
    <Editor height="480px" language="python" theme="vs-dark" value={value} onChange={v=>onChange(v ?? "")}
    loading={<p role="status">Loading Python editor…</p>} options={{readOnly,ariaLabel:"Python solution",tabFocusMode:true,minimap:{enabled:false},wordWrap:wordWrap?"on":"off",fontSize,tabSize:4,automaticLayout:true,scrollBeyondLastLine:false}}/></>;
}
