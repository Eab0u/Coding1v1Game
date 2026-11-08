import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const editor = vi.hoisted(() => ({ fails: false }));
vi.mock("next/dynamic", () => ({ default: () => function MockEditor({ value, onChange, readOnly, fontSize, wordWrap }: { value: string; onChange: (value: string) => void; readOnly: boolean; fontSize: number; wordWrap: boolean }) {
  if (editor.fails) throw new Error("Chunk unavailable");
  return <textarea wrap={wordWrap ? "soft" : "off"} style={{ fontSize }} aria-label="Python solution" value={value} onChange={event => onChange(event.target.value)} readOnly={readOnly}/>;
} }));
import { SolutionEditor } from "../src/components/solution-editor";
beforeEach(() => localStorage.clear());
afterEach(() => { editor.fails = false; vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
function Harness({ readOnly = false }: { readOnly?: boolean }) {
  const [value, setValue] = useState("def solve():\n    pass");
  return <SolutionEditor value={value} onChange={setValue} readOnly={readOnly} starter={"def solve():\n    pass"}/>;
}
it("restores preferences across visits without persisting code", () => {
  const first = render(<Harness/>);
  fireEvent.click(screen.getByRole("button", { name: "Use plain text editor" }));
  fireEvent.click(screen.getByRole("button", { name: "Wrap long lines" }));
  fireEvent.click(screen.getByRole("button", { name: "Increase solution text size" }));
  fireEvent.change(screen.getByLabelText("Python solution"), { target: { value: "private solution" } });
  expect(localStorage.getItem("codeduel:editor-preferences:v1")).toBe(JSON.stringify({ plain: true, wordWrap: true, fontSize: 16 }));
  first.unmount();
  render(<Harness readOnly/>);
  expect(screen.getByRole("button", { name: "Use advanced editor" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Wrap long lines" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByLabelText("Python solution")).toHaveStyle({ fontSize: "16px" });
  expect(screen.getByLabelText("Python solution")).toHaveValue("def solve():\n    pass");
});
it.each(["invalid json", "null", '{"fontSize":99,"plain":"true","wordWrap":1}', '{"fontSize":12.5}', '[]'])("ignores malformed stored preferences: %s", raw => {
  localStorage.setItem("codeduel:editor-preferences:v1", raw);
  render(<Harness/>);
  expect(screen.getByLabelText("Python solution")).toHaveStyle({ fontSize: "15px" });
  expect(screen.getByRole("button", { name: "Wrap long lines" })).toHaveAttribute("aria-pressed", "false");
  expect(screen.getByRole("button", { name: "Use plain text editor" })).toBeInTheDocument();
});
it("keeps valid fields when another stored preference is invalid", () => {
  localStorage.setItem("codeduel:editor-preferences:v1", '{"fontSize":100,"plain":true,"wordWrap":true}');
  render(<Harness/>);
  expect(screen.getByRole("button", { name: "Use advanced editor" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Wrap long lines" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByLabelText("Python solution")).toHaveStyle({ fontSize: "15px" });
});
it("keeps editing and controls usable when storage fails, then retries on a preference change", () => {
  const read = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Blocked"); });
  const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Full"); });
  render(<Harness/>);
  expect(screen.getByRole("status")).toHaveTextContent("Editor preferences apply for this visit");
  fireEvent.click(screen.getByRole("button", { name: "Use plain text editor" }));
  fireEvent.change(screen.getByLabelText("Python solution"), { target: { value: "still editable" } });
  expect(screen.getByLabelText("Python solution")).toHaveValue("still editable");
  write.mockRestore();
  fireEvent.click(screen.getByRole("button", { name: "Wrap long lines" }));
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  read.mockRestore();
  expect(JSON.parse(localStorage.getItem("codeduel:editor-preferences:v1")!)).toEqual({ plain: true, wordWrap: true, fontSize: 15 });
});
it.each([false, true])("copies exact current code in both editors with readOnly %s", async readOnly => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  render(<SolutionEditor value={"def solve():\n    return 'λ'\n"} onChange={vi.fn()} readOnly={readOnly}/>);
  for (let mode = 0; mode < 2; mode++) {
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Copy solution" })); });
    expect(screen.getByRole("status")).toHaveTextContent("Solution copied to clipboard");
    if (mode === 0) fireEvent.click(screen.getByRole("button", { name: "Use plain text editor" }));
  }
  expect(writeText.mock.calls).toEqual([["def solve():\n    return 'λ'\n"], ["def solve():\n    return 'λ'\n"]]);
  expect(screen.getByLabelText("Python solution")).toHaveValue("def solve():\n    return 'λ'\n");
});

it("reports unavailable clipboard and denied access, and allows retry", async () => {
  vi.stubGlobal("navigator", {});
  render(<Harness/>);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Copy solution" })); });
  expect(screen.getByRole("alert")).toHaveTextContent("Unable to copy");
  const writeText = vi.fn().mockRejectedValueOnce(new Error("Denied")).mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Copy solution" })); });
  expect(screen.getByRole("alert")).toHaveTextContent("Unable to copy");
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Copy solution" })); });
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("Solution copied");
});

it("prevents overlapping copies and hides feedback for code edited during copying", async () => {
  let finish!: () => void;
  const writeText = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  render(<Harness/>);
  fireEvent.click(screen.getByRole("button", { name: "Copy solution" }));
  const pending = screen.getByRole("button", { name: "Copying solution…" });
  expect(pending).toHaveAttribute("aria-disabled", "true");
  fireEvent.click(pending);
  fireEvent.change(screen.getByLabelText("Python solution"), { target: { value: "new draft" } });
  await act(async () => { finish(); });
  expect(writeText).toHaveBeenCalledExactlyOnceWith("def solve():\n    pass");
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Copy solution" })).toBeEnabled();
});
it.each([false, true])("requires confirmation to reset in plain mode %s and supports cancellation", plain => {
  render(<Harness/>);
  if (plain) fireEvent.click(screen.getByRole("button", { name: "Use plain text editor" }));
  const reset = screen.getByRole("button", { name: "Reset to starter code" });
  expect(reset).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Python solution"), { target: { value: "my draft" } });
  fireEvent.click(reset);
  expect(screen.getByLabelText("Python solution")).toHaveValue("my draft");
  fireEvent.click(screen.getByRole("button", { name: "Keep my solution" }));
  expect(screen.queryByRole("group", { name: "Confirm solution reset" })).not.toBeInTheDocument();
  expect(screen.getByLabelText("Python solution")).toHaveValue("my draft");
  fireEvent.click(reset);
  fireEvent.click(screen.getByRole("button", { name: "Replace with starter code" }));
  expect(screen.getByLabelText("Python solution")).toHaveValue("def solve():\n    pass");
  expect(reset).toBeDisabled();
  expect(screen.queryByRole("group", { name: "Confirm solution reset" })).not.toBeInTheDocument();
});
it("removes reset controls and confirmation when the match ends", () => {
  const view = render(<Harness/>);
  fireEvent.change(screen.getByLabelText("Python solution"), { target: { value: "keep final code" } });
  fireEvent.click(screen.getByRole("button", { name: "Reset to starter code" }));
  view.rerender(<Harness readOnly/>);
  expect(screen.queryByRole("button", { name: "Reset to starter code" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Replace with starter code" })).not.toBeInTheDocument();
  expect(screen.getByLabelText("Python solution")).toHaveValue("keep final code");
});
it.each([false, true])("moves reset confirmation focus safely and restores it on cancellation in plain mode %s", plain => {
  render(<Harness/>);
  if (plain) fireEvent.click(screen.getByRole("button", { name: "Use plain text editor" }));
  fireEvent.change(screen.getByLabelText("Python solution"), { target: { value: "valuable draft" } });
  const reset = screen.getByRole("button", { name: "Reset to starter code" });
  reset.focus();
  fireEvent.click(reset);
  expect(screen.getByRole("button", { name: "Keep my solution" })).toHaveFocus();
  fireEvent.click(screen.getByRole("button", { name: "Keep my solution" }));
  expect(reset).toHaveFocus();
  expect(screen.getByLabelText("Python solution")).toHaveValue("valuable draft");
  fireEvent.click(reset);
  const replace = screen.getByRole("button", { name: "Replace with starter code" });
  replace.focus();
  fireEvent.keyDown(replace, { key: "Escape" });
  expect(reset).toHaveFocus();
  expect(screen.queryByRole("group", { name: "Confirm solution reset" })).not.toBeInTheDocument();
  expect(screen.getByLabelText("Python solution")).toHaveValue("valuable draft");
});

it.each([false, true])("returns focus to the solution editor after confirming a reset in plain mode %s", plain => {
  render(<Harness/>);
  if (plain) fireEvent.click(screen.getByRole("button", { name: "Use plain text editor" }));
  fireEvent.change(screen.getByLabelText("Python solution"), { target: { value: "replace me" } });
  fireEvent.click(screen.getByRole("button", { name: "Reset to starter code" }));
  const keep = screen.getByRole("button", { name: "Keep my solution" });
  fireEvent.keyDown(keep, { key: "Enter" });
  expect(screen.getByRole("group", { name: "Confirm solution reset" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Replace with starter code" }));
  expect(screen.getByRole("group", { name: "Solution editor" })).toHaveFocus();
  expect(screen.getByLabelText("Python solution")).toHaveValue("def solve():\n    pass");
  expect(screen.getByRole("button", { name: "Reset to starter code" })).toBeDisabled();
  expect(screen.queryByRole("group", { name: "Confirm solution reset" })).not.toBeInTheDocument();
});
it("preserves edits in both directions when switching editor modes", () => {
  render(<Harness/>);
  fireEvent.change(screen.getByLabelText("Python solution"), { target: { value: "advanced draft" } });
  fireEvent.click(screen.getByRole("button", { name: "Use plain text editor" }));
  expect(screen.getByLabelText("Python solution")).toHaveValue("advanced draft");
  expect(screen.getByLabelText("Python solution")).toHaveAttribute("spellcheck", "false");
  fireEvent.change(screen.getByLabelText("Python solution"), { target: { value: "plain draft\n    return 1" } });
  fireEvent.click(screen.getByRole("button", { name: "Use advanced editor" }));
  expect(screen.getByLabelText("Python solution")).toHaveValue("plain draft\n    return 1");
});
it("recovers from editor failure with the current code and allows retry", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const view = render(<Harness/>);
  fireEvent.change(screen.getByLabelText("Python solution"), { target: { value: "saved code" } });
  editor.fails = true;
  view.rerender(<Harness readOnly/>);
  expect(screen.getByRole("status")).toHaveTextContent("Advanced editor unavailable");
  expect(screen.getByLabelText("Python solution")).toHaveValue("saved code");
  expect(screen.getByLabelText("Python solution")).toHaveAttribute("readonly");
  fireEvent.click(screen.getByRole("button", { name: "Use plain text editor" }));
  editor.fails = false;
  fireEvent.click(screen.getByRole("button", { name: "Use advanced editor" }));
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Python solution")).toHaveValue("saved code");
});
it("keeps plain text read only when a match ends", () => {
  const view = render(<Harness/>);
  fireEvent.click(screen.getByRole("button", { name: "Use plain text editor" }));
  view.rerender(<Harness readOnly/>);
  expect(screen.getByLabelText("Python solution")).toHaveAttribute("readonly");
});

it("downloads the exact current draft in either editor mode and after match end", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const create = vi.fn(() => "blob:solution");
  const revoke = vi.fn();
  vi.stubGlobal("URL", Object.assign(class extends URL {}, { createObjectURL: create, revokeObjectURL: revoke }));
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    expect(this.download).toBe("solution.py");
    expect(this.href).toBe("blob:solution");
    expect(this.isConnected).toBe(true);
  });
  const view = render(<Harness/>);
  const code = "def solve():\n    return '?'\n";
  fireEvent.change(screen.getByLabelText("Python solution"), { target: { value: code } });
  fireEvent.click(screen.getByRole("button", { name: "Download solution (.py)" }));
  fireEvent.click(screen.getByRole("button", { name: "Use plain text editor" }));
  fireEvent.click(screen.getByRole("button", { name: "Download solution (.py)" }));
  view.rerender(<Harness readOnly/>);
  fireEvent.click(screen.getByRole("button", { name: "Download solution (.py)" }));
  expect(click).toHaveBeenCalledTimes(3);
  for (const [blob] of create.mock.calls as unknown as [Blob][]) {
    expect(blob.type).toBe("text/x-python;charset=utf-8");
    expect(await new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsText(blob);
    })).toBe(code);
  }
  expect(document.querySelector("a[download]")).toBeNull();
  expect(revoke).not.toHaveBeenCalled();
  view.unmount();
  vi.advanceTimersByTime(1000);
  expect(revoke).toHaveBeenCalledTimes(3);
});

it("reports download failures, cleans up and permits retry", () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const revoke = vi.fn();
  const create = vi.fn().mockImplementationOnce(() => { throw new Error("Unavailable"); }).mockReturnValue("blob:retry");
  vi.stubGlobal("URL", Object.assign(class extends URL {}, { createObjectURL: create, revokeObjectURL: revoke }));
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementationOnce(() => { throw new Error("Blocked"); }).mockImplementation(() => {});
  render(<Harness/>);
  const button = screen.getByRole("button", { name: "Download solution (.py)" });
  fireEvent.click(button);
  expect(screen.getByRole("alert")).toHaveTextContent("Unable to download");
  fireEvent.click(button);
  expect(screen.getByRole("alert")).toBeInTheDocument();
  expect(document.querySelector("a[download]")).toBeNull();
  fireEvent.click(button);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  vi.advanceTimersByTime(1000);
  expect(revoke).toHaveBeenCalledTimes(2);
});

it.each([false, true])("adjusts and bounds text size without editing code in plain mode %s", plain => {
  render(<Harness/>);
  if (plain) fireEvent.click(screen.getByRole("button", { name: "Use plain text editor" }));
  const solution = screen.getByLabelText("Python solution");
  const increase = screen.getByRole("button", { name: "Increase solution text size" });
  const decrease = screen.getByRole("button", { name: "Decrease solution text size" });
  const reset = screen.getByRole("button", { name: "Reset text size" });
  expect(solution).toHaveStyle({ fontSize: "15px" });
  expect(reset).toBeDisabled();
  for (let i = 0; i < 15; i++) fireEvent.click(increase);
  expect(solution).toHaveStyle({ fontSize: "24px" });
  expect(increase).toBeDisabled();
  expect(screen.getByText("24px")).toHaveAttribute("aria-live", "polite");
  for (let i = 0; i < 20; i++) fireEvent.click(decrease);
  expect(solution).toHaveStyle({ fontSize: "12px" });
  expect(decrease).toBeDisabled();
  fireEvent.click(reset);
  expect(solution).toHaveStyle({ fontSize: "15px" });
  expect(solution).toHaveValue("def solve():\n    pass");
});
it("retains text size when switching modes and after match completion", () => {
  const view = render(<Harness/>);
  fireEvent.click(screen.getByRole("button", { name: "Increase solution text size" }));
  fireEvent.click(screen.getByRole("button", { name: "Use plain text editor" }));
  expect(screen.getByLabelText("Python solution")).toHaveStyle({ fontSize: "16px" });
  view.rerender(<Harness readOnly/>);
  fireEvent.click(screen.getByRole("button", { name: "Increase solution text size" }));
  expect(screen.getByLabelText("Python solution")).toHaveStyle({ fontSize: "17px" });
  expect(screen.getByLabelText("Python solution")).toHaveAttribute("readonly");
  fireEvent.click(screen.getByRole("button", { name: "Use advanced editor" }));
  expect(screen.getByLabelText("Python solution")).toHaveStyle({ fontSize: "17px" });
});
it("preserves text size in the automatic plain-text fallback", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const view = render(<Harness/>);
  fireEvent.click(screen.getByRole("button", { name: "Increase solution text size" }));
  editor.fails = true;
  view.rerender(<Harness readOnly/>);
  expect(screen.getByLabelText("Python solution")).toHaveStyle({ fontSize: "16px" });
});


it.each([false, true])("shares reversible line wrapping across editor modes with readOnly %s", readOnly => {
  render(<Harness readOnly={readOnly}/>);
  const code = "def solve():\n    pass";
  const toggle = screen.getByRole("button", { name: "Wrap long lines" });
  expect(toggle).toHaveAttribute("aria-pressed", "false");
  expect(screen.getByLabelText("Python solution")).toHaveAttribute("wrap", "off");
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByLabelText("Python solution")).toHaveAttribute("wrap", "soft");
  fireEvent.click(screen.getByRole("button", { name: "Use plain text editor" }));
  expect(screen.getByLabelText("Python solution")).toHaveAttribute("wrap", "soft");
  expect(screen.getByLabelText("Python solution")).toHaveStyle({ whiteSpace: "pre-wrap", overflowWrap: "anywhere" });
  expect(screen.getByLabelText("Python solution")).toHaveValue(code);
  fireEvent.click(toggle);
  expect(screen.getByLabelText("Python solution")).toHaveAttribute("wrap", "off");
  fireEvent.click(screen.getByRole("button", { name: "Use advanced editor" }));
  expect(screen.getByLabelText("Python solution")).toHaveAttribute("wrap", "off");
  expect(screen.getByLabelText("Python solution")).toHaveValue(code);
});

it("preserves wrapping on automatic advanced editor failure", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const view = render(<Harness/>);
  fireEvent.click(screen.getByRole("button", { name: "Wrap long lines" }));
  editor.fails = true;
  view.rerender(<Harness readOnly/>);
  expect(screen.getByLabelText("Python solution")).toHaveAttribute("wrap", "soft");
  expect(screen.getByLabelText("Python solution")).toHaveAttribute("readonly");
  fireEvent.click(screen.getByRole("button", { name: "Wrap long lines" }));
  expect(screen.getByLabelText("Python solution")).toHaveAttribute("wrap", "off");
});
it.each([false, true])("expires reset confirmation on edits without reviving it when code returns, plain mode %s", plain => {
  render(<Harness/>);
  if (plain) fireEvent.click(screen.getByRole("button", { name: "Use plain text editor" }));
  const input = screen.getByLabelText("Python solution");
  fireEvent.change(input, { target: { value: "first draft" } });
  fireEvent.click(screen.getByRole("button", { name: "Reset to starter code" }));
  input.focus();
  fireEvent.change(input, { target: { value: "new work" } });
  expect(screen.queryByRole("button", { name: "Replace with starter code" })).not.toBeInTheDocument();
  expect(input).toHaveFocus();
  expect(input).toHaveValue("new work");
  fireEvent.change(input, { target: { value: "first draft" } });
  expect(screen.queryByRole("group", { name: "Confirm solution reset" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Reset to starter code" }));
  fireEvent.click(screen.getByRole("button", { name: "Replace with starter code" }));
  expect(input).toHaveValue("def solve():\n    pass");
});

it.each(["starter", "readOnly", "value", "missing starter"])("requires a fresh reset request after %s changes and returns", change => {
  const onChange = vi.fn();
  const props = { value: "valuable code", starter: "original starter", readOnly: false, onChange };
  const view = render(<SolutionEditor {...props}/>);
  fireEvent.click(screen.getByRole("button", { name: "Reset to starter code" }));
  const changed = change === "starter" ? { starter: "new starter" }
    : change === "readOnly" ? { readOnly: true }
    : change === "missing starter" ? { starter: undefined } : { value: "external draft" };
  view.rerender(<SolutionEditor {...props} {...changed}/>);
  expect(screen.queryByRole("button", { name: "Replace with starter code" })).not.toBeInTheDocument();
  expect(onChange).not.toHaveBeenCalled();
  view.rerender(<SolutionEditor {...props}/>);
  expect(screen.queryByRole("button", { name: "Replace with starter code" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Reset to starter code" }));
  fireEvent.click(screen.getByRole("button", { name: "Replace with starter code" }));
  expect(onChange).toHaveBeenCalledExactlyOnceWith("original starter");
});


it.each([true, false])("expires completed clipboard feedback permanently after edits (success %s)", async ok => {
  vi.stubGlobal("navigator", { clipboard: { writeText: ok ? vi.fn().mockResolvedValue(undefined) : vi.fn().mockRejectedValue(new Error("Denied")) } });
  render(<Harness/>);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Copy solution" })); });
  expect(screen.getByRole(ok ? "status" : "alert")).toHaveTextContent(ok ? "Solution copied" : "Unable to copy");
  fireEvent.change(screen.getByLabelText("Python solution"), { target: { value: "new draft" } });
  fireEvent.change(screen.getByLabelText("Python solution"), { target: { value: "def solve():\n    pass" } });
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Copy solution" })); });
  expect(screen.getByRole(ok ? "status" : "alert")).toBeInTheDocument();
});

it.each([true, false])("discards pending clipboard feedback after editing and restoring the draft (success %s)", async ok => {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn(() => new Promise<void>((yes, no) => { resolve = yes; reject = no; })) } });
  render(<Harness/>);
  fireEvent.click(screen.getByRole("button", { name: "Copy solution" }));
  fireEvent.change(screen.getByLabelText("Python solution"), { target: { value: "new draft" } });
  fireEvent.change(screen.getByLabelText("Python solution"), { target: { value: "def solve():\n    pass" } });
  await act(async () => { if (ok) resolve(); else reject(new Error("Denied")); });
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Copy solution" })).toBeEnabled();
  expect(screen.getByLabelText("Python solution")).toHaveValue("def solve():\n    pass");
});

it.each([false, true])("retries advanced editor failures while preserving fallback work and settings, readOnly %s", readOnly => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  editor.fails = true;
  render(<Harness readOnly={readOnly}/>);
  fireEvent.click(screen.getByRole("button", { name: "Increase solution text size" }));
  fireEvent.click(screen.getByRole("button", { name: "Wrap long lines" }));
  const code = readOnly ? "def solve():\n    pass" : "def solve():\n    return 'fallback work'";
  if (!readOnly) fireEvent.change(screen.getByLabelText("Python solution"), { target: { value: code } });
  const preferences = localStorage.getItem("codeduel:editor-preferences:v1");
  const guidanceId = screen.getByRole("status").id;
  expect(screen.getByRole("status")).toHaveClass("solution-editor-recovery");
  expect(screen.getByRole("status")).toHaveAttribute("aria-atomic", "true");
  for (let attempt = 0; attempt < 2; attempt++) {
    expect(screen.getByRole("button", { name: "Retry advanced editor" })).toHaveAttribute("aria-describedby", guidanceId);
    expect(screen.getByRole("button", { name: "Retry advanced editor" })).toHaveAccessibleDescription(/your code is preserved.*current solution and preferences/);
    fireEvent.click(screen.getByRole("button", { name: "Retry advanced editor" }));
    expect(screen.getByRole("status")).toHaveTextContent("Advanced editor unavailable");
    expect(screen.getByRole("status")).toHaveAttribute("id", guidanceId);
    expect(screen.getByRole("group", { name: "Solution editor" })).toHaveFocus();
    expect(screen.getByLabelText("Python solution")).toHaveValue(code);
  }
  editor.fails = false;
  fireEvent.click(screen.getByRole("button", { name: "Retry advanced editor" }));
  expect(screen.queryByRole("button", { name: "Retry advanced editor" })).not.toBeInTheDocument();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Python solution")).toHaveValue(code);
  expect(screen.getByLabelText("Python solution")).toHaveStyle({ fontSize: "16px" });
  expect(screen.getByLabelText("Python solution")).toHaveAttribute("wrap", "soft");
  expect(screen.getByLabelText("Python solution").hasAttribute("readonly")).toBe(readOnly);
  expect(localStorage.getItem("codeduel:editor-preferences:v1")).toBe(preferences);
  expect(screen.getByRole("group", { name: "Solution editor" })).toHaveFocus();
});

it("isolates advanced editor recovery descriptions and clears them when switching to plain text", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  editor.fails = true;
  render(<><Harness/><Harness readOnly/></>);
  const groups = screen.getAllByRole("group", { name: "Solution editor" });
  const ids = groups.map(group => within(group).getByRole("status").id);
  expect(new Set(ids).size).toBe(2);
  groups.forEach((group, index) => {
    expect(within(group).getByRole("button", { name: "Retry advanced editor" })).toHaveAttribute("aria-describedby", ids[index]);
  });
  fireEvent.click(within(groups[0]).getByRole("button", { name: "Use plain text editor" }));
  expect(document.getElementById(ids[0])).toBeNull();
  expect(within(groups[0]).queryByRole("button", { name: "Retry advanced editor" })).not.toBeInTheDocument();
  expect(document.getElementById(ids[1])).toBeInTheDocument();
});


it.each([false, true])("expires download errors after editing and restoring code in plain mode %s", plain => {
  vi.stubGlobal("URL", Object.assign(class extends URL {}, {
    createObjectURL: vi.fn(() => { throw new Error("Unavailable"); }),
  }));
  render(<Harness/>);
  if (plain) fireEvent.click(screen.getByRole("button", { name: "Use plain text editor" }));
  const button = screen.getByRole("button", { name: "Download solution (.py)" });
  fireEvent.click(button);
  expect(screen.getByRole("alert")).toHaveTextContent("Unable to download");
  fireEvent.click(screen.getByRole("button", { name: "Increase solution text size" }));
  fireEvent.click(screen.getByRole("button", { name: "Wrap long lines" }));
  expect(screen.getByRole("alert")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Python solution"), { target: { value: "new solution" } });
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Python solution"), { target: { value: "def solve():\n    pass" } });
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Python solution")).toHaveValue("def solve():\n    pass");
  expect(screen.getByLabelText("Python solution")).toHaveStyle({ fontSize: "16px" });
  expect(screen.getByRole("button", { name: "Wrap long lines" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(button);
  expect(screen.getByRole("alert")).toHaveTextContent("Unable to download");
});

it.each([false, true])("expires download errors after external draft replacement with readOnly %s", readOnly => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const create = vi.fn().mockImplementationOnce(() => { throw new Error("Unavailable"); }).mockReturnValue("blob:recovered");
  const revoke = vi.fn();
  vi.stubGlobal("URL", Object.assign(class extends URL {}, { createObjectURL: create, revokeObjectURL: revoke }));
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  const onChange = vi.fn();
  const view = render(<SolutionEditor value="original" onChange={onChange} readOnly={readOnly}/>);
  fireEvent.click(screen.getByRole("button", { name: "Download solution (.py)" }));
  expect(screen.getByRole("alert")).toBeInTheDocument();
  view.rerender(<SolutionEditor value="replacement" onChange={onChange} readOnly={readOnly}/>);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  view.rerender(<SolutionEditor value="original" onChange={onChange} readOnly={readOnly}/>);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Download solution (.py)" }));
  expect(click).toHaveBeenCalledOnce();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Python solution")).toHaveValue("original");
  expect(onChange).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1000);
  expect(revoke).toHaveBeenCalledWith("blob:recovered");
});


it.each([false, true])("describes reset consequences on the focused action and preserves the description across preferences (plain=%s)", plain => {
  render(<SolutionEditor value="edited" onChange={vi.fn()} readOnly={false} starter="pass"/>);
  if (plain) fireEvent.click(screen.getByRole("button", { name: "Use plain text editor" }));
  fireEvent.click(screen.getByRole("button", { name: "Reset to starter code" }));
  const group = screen.getByRole("group", { name: "Confirm solution reset" });
  const keep = within(group).getByRole("button", { name: "Keep my solution" });
  const replace = within(group).getByRole("button", { name: "Replace with starter code" });
  const warning = "Replace your current solution with the starter code? Editing your solution dismisses this confirmation. Download your solution first if you want to keep it.";
  expect(keep).toHaveFocus();
  for (const control of [group, keep, replace]) expect(control).toHaveAccessibleDescription(warning);
  const id = keep.getAttribute("aria-describedby");
  fireEvent.click(screen.getByRole("button", { name: "Wrap long lines" }));
  expect(keep).toHaveAttribute("aria-describedby", id);
  replace.focus();
  fireEvent.keyDown(replace, { key: "Escape" });
  expect(screen.queryByRole("group", { name: "Confirm solution reset" })).not.toBeInTheDocument();
  expect(document.getElementById(id!)).toBeNull();
  expect(screen.getByRole("button", { name: "Reset to starter code" })).toHaveFocus();
});

it("isolates reset descriptions between editors", () => {
  render(<><SolutionEditor value="one" onChange={vi.fn()} readOnly={false} starter="pass"/>
    <SolutionEditor value="two" onChange={vi.fn()} readOnly={false} starter="pass"/></>);
  for (const reset of screen.getAllByRole("button", { name: "Reset to starter code" })) fireEvent.click(reset);
  const groups = screen.getAllByRole("group", { name: "Confirm solution reset" });
  const ids = groups.map(group => group.getAttribute("aria-describedby"));
  expect(new Set(ids).size).toBe(2);
  groups.forEach((group, index) => {
    expect(group.querySelector("p")).toHaveAttribute("id", ids[index]);
    for (const button of within(group).getAllByRole("button")) expect(button).toHaveAttribute("aria-describedby", ids[index]);
  });
});

it.each([true, false])("announces pending clipboard permission and clears busy state after settlement (success %s)", async ok => {
  let resolve!: () => void;
  let reject!: (reason: Error) => void;
  const writeText = vi.fn(() => new Promise<void>((yes, no) => { resolve = yes; reject = no; }));
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  render(<Harness/>);
  fireEvent.click(screen.getByRole("button", { name: "Copy solution" }));
  const pending = screen.getByRole("button", { name: /^Copying solution/ });
  expect(pending).toHaveAttribute("aria-disabled", "true");
  expect(pending).toHaveAttribute("aria-busy", "true");
  const notice = screen.getByRole("status");
  expect(notice).toHaveAttribute("aria-atomic", "true");
  expect(notice).toHaveTextContent("browser may ask for clipboard permission");
  fireEvent.change(screen.getByLabelText("Python solution"), { target: { value: "changed while waiting" } });
  fireEvent.click(screen.getByRole("button", { name: "Use plain text editor" }));
  expect(screen.getByRole("status")).toBe(notice);
  expect(notice).toHaveTextContent("solution captured when you clicked Copy");
  expect(screen.getByLabelText("Python solution")).toHaveValue("changed while waiting");
  await act(async () => { if (ok) resolve(); else reject(new Error("Denied")); });
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Copy solution" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Copy solution" })).toHaveAttribute("aria-busy", "false");
  expect(writeText).toHaveBeenCalledExactlyOnceWith("def solve():\n    pass");
});

it.each([true, false])("keeps pending Copy in keyboard navigation without stealing focus on settlement (success %s)", async ok => {
  let settle!: () => void;
  const writeText = vi.fn(() => new Promise<void>((resolve, reject) => {
    settle = () => ok ? resolve() : reject(new Error("Denied"));
  }));
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  render(<Harness/>);
  const copy = screen.getByRole("button", { name: "Copy solution" });
  copy.focus();
  fireEvent.click(copy);
  expect(copy).toHaveFocus();
  expect(copy).not.toBeDisabled();
  expect(copy.tabIndex).toBe(0);
  expect(copy).toHaveAccessibleDescription(/browser may ask for clipboard permission/);
  const description = copy.getAttribute("aria-describedby");
  fireEvent.click(copy);
  expect(writeText).toHaveBeenCalledTimes(1);
  const download = screen.getByRole("button", { name: "Download solution (.py)" });
  download.focus();
  expect(download).toHaveFocus();
  copy.focus();
  expect(copy).toHaveFocus();
  expect(copy).toHaveAttribute("aria-describedby", description);
  download.focus();
  await act(async () => { settle(); });
  expect(download).toHaveFocus();
  expect(copy).toHaveAttribute("aria-disabled", "false");
  expect(copy).toHaveAccessibleDescription(ok ? "Solution copied to clipboard." : "Unable to copy your solution. Try again, download it or select and copy the code manually.");
  expect(copy.getAttribute("aria-describedby")).not.toBe(description);
  expect(document.getElementById(description!)).toBeNull();
  await act(async () => { fireEvent.click(copy); settle(); });
  expect(writeText).toHaveBeenCalledTimes(2);
});

it("isolates pending copy descriptions and busy states between editors", async () => {
  const completions: (() => void)[] = [];
  vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn(() => new Promise<void>(resolve => completions.push(resolve))) } });
  render(<><Harness/><Harness readOnly/></>);
  const copies = screen.getAllByRole("button", { name: "Copy solution" });
  fireEvent.click(copies[0]);
  expect(copies[1]).toHaveAttribute("aria-disabled", "false");
  expect(copies[1]).not.toHaveAttribute("aria-describedby");
  fireEvent.click(copies[1]);
  const ids = copies.map(copy => copy.getAttribute("aria-describedby"));
  expect(new Set(ids).size).toBe(2);
  for (const copy of copies) expect(copy).toHaveAccessibleDescription(/You can keep editing/);
  await act(async () => { completions[0](); });
  expect(document.getElementById(ids[0]!)).toBeNull();
  expect(copies[1]).toHaveAttribute("aria-describedby", ids[1]);
  expect(copies[1]).toHaveAttribute("aria-busy", "true");
  await act(async () => { completions[1](); });
});


it.each([false, true])("shows draft-scoped download guidance without moving focus with readOnly %s", readOnly => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  vi.stubGlobal("URL", Object.assign(class extends URL {}, {
    createObjectURL: vi.fn(() => "blob:download"), revokeObjectURL: vi.fn(),
  }));
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  const view = render(<SolutionEditor value="original" onChange={vi.fn()} readOnly={readOnly}/>);
  const button = screen.getByRole("button", { name: "Download solution (.py)" });
  button.focus();
  fireEvent.click(button);
  const notice = screen.getByRole("status");
  expect(button).toHaveAccessibleDescription(notice.textContent!);
  expect(notice).toHaveClass("solution-download-notice");
  const descriptionId = notice.id;
  expect(notice).toHaveTextContent("Download requested. Check your browser downloads for solution.py; your browser may ask where to save it.");
  expect(notice).toHaveAttribute("aria-atomic", "true");
  expect(button).toHaveFocus();
  fireEvent.click(screen.getByRole("button", { name: "Use plain text editor" }));
  expect(screen.getByRole("status")).toBe(notice);
  expect(button).toHaveAttribute("aria-describedby", descriptionId);
  view.rerender(<SolutionEditor value="replacement" onChange={vi.fn()} readOnly={readOnly}/>);
  expect(button).not.toHaveAttribute("aria-describedby");
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  view.rerender(<SolutionEditor value="original" onChange={vi.fn()} readOnly={readOnly}/>);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  click.mockImplementationOnce(() => { throw new Error("Blocked"); });
  fireEvent.click(button);
  expect(screen.getByRole("alert")).toHaveTextContent("Unable to download");
  expect(button).toHaveAccessibleDescription(screen.getByRole("alert").textContent!);
  expect(screen.getByRole("alert")).toHaveClass("solution-download-notice--error");
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  fireEvent.click(button);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("Download requested");
  expect(button).toHaveFocus();
  act(() => vi.advanceTimersByTime(1000));
});

it("isolates download descriptions between editors and unrelated copy feedback", async () => {
  vi.stubGlobal("URL", Object.assign(class extends URL {}, {
    createObjectURL: vi.fn(() => "blob:download"), revokeObjectURL: vi.fn(),
  }));
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  render(<><SolutionEditor value="first" onChange={vi.fn()} readOnly={false}/><SolutionEditor value="second" onChange={vi.fn()} readOnly/></>);
  const buttons = screen.getAllByRole("button", { name: "Download solution (.py)" });
  expect(buttons[0]).not.toHaveAttribute("aria-describedby");
  fireEvent.click(buttons[0]);
  expect(buttons[1]).not.toHaveAttribute("aria-describedby");
  fireEvent.click(buttons[1]);
  expect(buttons[0].getAttribute("aria-describedby")).not.toBe(buttons[1].getAttribute("aria-describedby"));
  await act(async () => { fireEvent.click(screen.getAllByRole("button", { name: "Copy solution" })[0]); });
  for (const button of buttons) expect(button).toHaveAccessibleDescription(/Download requested/);
});
it.each([false, true])("associates styled copy results and clears stale descriptions with readOnly %s", async readOnly => {
  const writeText = vi.fn().mockRejectedValueOnce(new Error("Denied")).mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  const view = render(<SolutionEditor value="draft" onChange={vi.fn()} readOnly={readOnly}/>);
  const copy = screen.getByRole("button", { name: "Copy solution" });
  copy.focus();
  await act(async () => { fireEvent.click(copy); });
  const error = screen.getByRole("alert");
  expect(copy).toHaveAttribute("aria-describedby", error.id);
  expect(error).toHaveClass("solution-copy-notice", "solution-copy-notice--error");
  expect(copy).toHaveFocus();
  await act(async () => { fireEvent.click(copy); });
  const success = screen.getByText("Solution copied to clipboard.");
  expect(copy).toHaveAttribute("aria-describedby", success.id);
  expect(success).toHaveClass("solution-copy-notice");
  expect(success).not.toHaveClass("solution-copy-notice--error");
  expect(success).toHaveAttribute("aria-atomic", "true");
  expect(copy).toHaveFocus();
  fireEvent.click(screen.getByRole("button", { name: "Use plain text editor" }));
  expect(copy).toHaveAttribute("aria-describedby", success.id);
  view.rerender(<SolutionEditor value="changed" onChange={vi.fn()} readOnly={readOnly}/>);
  expect(copy).not.toHaveAttribute("aria-describedby");
  view.rerender(<SolutionEditor value="draft" onChange={vi.fn()} readOnly={readOnly}/>);
  expect(copy).not.toHaveAttribute("aria-describedby");
  expect(screen.queryByText("Solution copied to clipboard.")).not.toBeInTheDocument();
});

it("isolates clipboard completion descriptions between editors", async () => {
  vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  render(<><SolutionEditor value="one" onChange={vi.fn()} readOnly={false}/><SolutionEditor value="two" onChange={vi.fn()} readOnly/></>);
  const copies = screen.getAllByRole("button", { name: "Copy solution" });
  await act(async () => { fireEvent.click(copies[0]); });
  expect(copies[1]).not.toHaveAttribute("aria-describedby");
  await act(async () => { fireEvent.click(copies[1]); });
  const notices = screen.getAllByText("Solution copied to clipboard.");
  expect(copies[0]).toHaveAttribute("aria-describedby", notices[0].id);
  expect(copies[1]).toHaveAttribute("aria-describedby", notices[1].id);
  expect(notices[0].id).not.toBe(notices[1].id);
});
it.each([false, true])("associates preference storage recovery guidance with each editor's controls, readOnly %s", readOnly => {
  const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Full"); });
  render(<><SolutionEditor value="first draft" onChange={vi.fn()} readOnly={readOnly}/><SolutionEditor value="second draft" onChange={vi.fn()} readOnly={readOnly}/></>);
  const groups = screen.getAllByRole("group", { name: "Solution editor" });
  const ids = groups.map(group => {
    const notice = within(group).getByRole("status");
    expect(notice).toHaveClass("solution-editor-recovery");
    expect(notice).toHaveAttribute("aria-atomic", "true");
    expect(notice).toHaveTextContent("retries saving your preferences; your solution stays in the editor");
    for (const name of ["Decrease solution text size", "Increase solution text size", "Reset text size", "Wrap long lines", "Use plain text editor"]) {
      expect(within(group).getByRole("button", { name })).toHaveAttribute("aria-describedby", notice.id);
    }
    return notice.id;
  });
  expect(ids[0]).not.toBe(ids[1]);
  const wrap = within(groups[0]).getByRole("button", { name: "Wrap long lines" });
  wrap.focus();
  fireEvent.click(wrap);
  expect(wrap).toHaveFocus();
  expect(within(groups[0]).getByRole("status")).toHaveAttribute("id", ids[0]);
  write.mockRestore();
  fireEvent.click(wrap);
  expect(wrap).toHaveFocus();
  expect(within(groups[0]).queryByRole("status")).not.toBeInTheDocument();
  for (const name of ["Decrease solution text size", "Increase solution text size", "Reset text size", "Wrap long lines", "Use plain text editor"]) {
    expect(within(groups[0]).getByRole("button", { name })).not.toHaveAttribute("aria-describedby");
  }
  expect(within(groups[1]).getByRole("status")).toHaveAttribute("id", ids[1]);
  expect(within(groups[0]).getByLabelText("Python solution")).toHaveValue("first draft");
  expect(within(groups[1]).getByLabelText("Python solution")).toHaveValue("second draft");
});

it.each([false, true])("retries saving unchanged preferences with isolated recovery and focus, readOnly %s", readOnly => {
  localStorage.setItem("codeduel:editor-preferences:v1", JSON.stringify({ plain: true, wordWrap: true, fontSize: 24 }));
  const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Full"); });
  const change = vi.fn();
  render(<><SolutionEditor value="private first draft" onChange={change} readOnly={readOnly}/><SolutionEditor value="private second draft" onChange={change} readOnly={readOnly}/></>);
  const groups = screen.getAllByRole("group", { name: "Solution editor" });
  const retry = within(groups[0]).getByRole("button", { name: "Retry saving preferences" });
  const notice = within(groups[0]).getByRole("status");
  expect(retry).toHaveAttribute("aria-describedby", notice.id);
  retry.focus();
  fireEvent.click(retry);
  expect(retry).toHaveFocus();
  expect(within(groups[0]).getByRole("status")).toBe(notice);
  write.mockRestore();
  fireEvent.click(retry);
  expect(groups[0]).toHaveFocus();
  expect(within(groups[0]).queryByRole("status")).not.toBeInTheDocument();
  expect(within(groups[0]).queryByRole("button", { name: "Retry saving preferences" })).not.toBeInTheDocument();
  expect(within(groups[1]).getByRole("button", { name: "Retry saving preferences" })).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem("codeduel:editor-preferences:v1")!)).toEqual({ plain: true, wordWrap: true, fontSize: 24 });
  expect(within(groups[0]).getByLabelText("Python solution")).toHaveValue("private first draft");
  expect(within(groups[1]).getByLabelText("Python solution")).toHaveValue("private second draft");
  expect(change).not.toHaveBeenCalled();
  const otherRetry = within(groups[1]).getByRole("button", { name: "Retry saving preferences" });
  fireEvent.click(otherRetry);
  expect(groups[0]).toHaveFocus();
  expect(within(groups[1]).queryByRole("status")).not.toBeInTheDocument();
});
