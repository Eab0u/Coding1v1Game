import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
const editor = vi.hoisted(() => ({ fails: false }));
vi.mock("next/dynamic", () => ({ default: () => function MockEditor({ value, onChange, readOnly, fontSize }: { value: string; onChange: (value: string) => void; readOnly: boolean; fontSize: number }) {
  if (editor.fails) throw new Error("Chunk unavailable");
  return <textarea style={{ fontSize }} aria-label="Python solution" value={value} onChange={event => onChange(event.target.value)} readOnly={readOnly}/>;
} }));
import { SolutionEditor } from "../src/components/solution-editor";
afterEach(() => { editor.fails = false; vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
function Harness({ readOnly = false }: { readOnly?: boolean }) {
  const [value, setValue] = useState("def solve():\n    pass");
  return <SolutionEditor value={value} onChange={setValue} readOnly={readOnly} starter={"def solve():\n    pass"}/>;
}
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
