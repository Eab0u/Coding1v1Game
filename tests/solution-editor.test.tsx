import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
const editor = vi.hoisted(() => ({ fails: false }));
vi.mock("next/dynamic", () => ({ default: () => function MockEditor({ value, onChange, readOnly }: { value: string; onChange: (value: string) => void; readOnly: boolean }) {
  if (editor.fails) throw new Error("Chunk unavailable");
  return <textarea aria-label="Python solution" value={value} onChange={event => onChange(event.target.value)} readOnly={readOnly}/>;
} }));
import { SolutionEditor } from "../src/components/solution-editor";
afterEach(() => { editor.fails = false; vi.restoreAllMocks(); });
function Harness({ readOnly = false }: { readOnly?: boolean }) {
  const [value, setValue] = useState("def solve():\n    pass");
  return <SolutionEditor value={value} onChange={setValue} readOnly={readOnly}/>;
}
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
