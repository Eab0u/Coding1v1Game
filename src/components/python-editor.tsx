"use client";
import Editor, { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
loader.config({ monaco });
export default function PythonEditor({value,onChange,readOnly}:{value:string;onChange:(value:string)=>void;readOnly:boolean}) {
  return <Editor height="480px" language="python" theme="vs-dark" value={value} onChange={v=>onChange(v ?? "")}
    loading={<p role="status">Loading Python editor…</p>} options={{readOnly,ariaLabel:"Python solution",minimap:{enabled:false},fontSize:15,tabSize:4,automaticLayout:true,scrollBeyondLastLine:false}}/>;
}
