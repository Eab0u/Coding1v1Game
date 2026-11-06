import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { expect, it, vi } from "vitest";
import { PlainPythonEditor } from "../src/components/plain-python-editor";

function Harness({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  return <PlainPythonEditor value={value} onChange={setValue} readOnly={false}/>;
}

it.each([
  ["def solve():", 12, 12, "def solve():\n    ", 17],
  ["    return 1", 12, 12, "    return 1\n    ", 17],
  ["\tif ready:  ", 12, 12, "\tif ready:  \n\t    ", 18],
  ["    hello world", 9, 15, "    hello\n    ", 14],
  ["    first\n    second", 9, 9, "    first\n    \n    second", 14],
  ["\ncode", 0, 0, "\n\ncode", 1],
])("indents at the caret and replaces selections: %s", (initial, start, end, expected, position) => {
  render(<Harness initial={initial}/>);
  const input = screen.getByRole("textbox") as HTMLTextAreaElement;
  input.focus();
  input.setSelectionRange(start, end);
  expect(fireEvent.keyDown(input, { key: "Enter" })).toBe(false);
  expect(input).toHaveValue(expected);
  expect(input.selectionStart).toBe(position);
  expect(input.selectionEnd).toBe(position);
  expect(input).toHaveFocus();
});

it.each([
  { key: "Tab" }, { key: "Enter", shiftKey: true }, { key: "Enter", ctrlKey: true },
  { key: "Enter", metaKey: true }, { key: "Enter", altKey: true }, { key: "Enter", isComposing: true },
])("preserves native keyboard behavior for %j", event => {
  const change = vi.fn();
  render(<PlainPythonEditor value="    code" onChange={change} readOnly={false}/>);
  expect(fireEvent.keyDown(screen.getByRole("textbox"), event)).toBe(true);
  expect(change).not.toHaveBeenCalled();
  expect(screen.getByRole("textbox")).toHaveAccessibleDescription(/Tab moves to the next control/);
});

it("does not alter completed solutions", () => {
  const change = vi.fn();
  render(<PlainPythonEditor value="def solve():" onChange={change} readOnly/>);
  expect(fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" })).toBe(true);
  expect(change).not.toHaveBeenCalled();
});
