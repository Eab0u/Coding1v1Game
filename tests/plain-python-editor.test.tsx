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
  expect(screen.getByRole("button", { name: "Indent" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Outdent" })).toBeDisabled();
});

it.each([
  ["one\ntwo", 1, 1, "Indent", "    one\ntwo", 5, 5],
  ["one\ntwo\nthree", 0, 8, "Indent", "    one\n    two\nthree", 4, 16],
  ["    one\n  two\n\tthree", 2, 17, "Outdent", "one\ntwo\nthree", 0, 10],
  ["\ncode", 0, 0, "Indent", "    \ncode", 4, 4],
  ["one\n", 4, 4, "Indent", "one\n    ", 8, 8],
  ["        one", 9, 11, "Outdent", "    one", 5, 7],
  ["one\n  two", 0, 9, "Outdent", "one\ntwo", 0, 7],
] as const)("adjusts block indentation and preserves selection: %s %s %s %s", (initial, start, end, action, expected, nextStart, nextEnd) => {
  render(<Harness initial={initial}/>);
  const input = screen.getByRole("textbox") as HTMLTextAreaElement;
  input.focus();
  input.setSelectionRange(start, end);
  fireEvent.click(screen.getByRole("button", { name: action }));
  expect(input).toHaveValue(expected);
  expect(input.selectionStart).toBe(nextStart);
  expect(input.selectionEnd).toBe(nextEnd);
  expect(input).toHaveFocus();
});

it("keeps an unindented outdent unchanged and returns focus to the code", () => {
  const change = vi.fn();
  render(<PlainPythonEditor value="code" onChange={change} readOnly={false}/>);
  const input = screen.getByRole("textbox") as HTMLTextAreaElement;
  input.setSelectionRange(1, 3);
  fireEvent.click(screen.getByRole("button", { name: "Outdent" }));
  expect(change).not.toHaveBeenCalled();
  expect(input).toHaveFocus();
  expect(input.selectionStart).toBe(1);
  expect(input.selectionEnd).toBe(3);
});

it("tracks the active end of forward and backward selections without live announcements", () => {
  render(<Harness initial={'one\n\ttwo\n'}/>);
  const input = screen.getByRole('textbox') as HTMLTextAreaElement;
  const status = screen.getByLabelText('Solution cursor position');
  expect(status).toHaveTextContent('Line 1, column 1');
  expect(status).toHaveAttribute('aria-live', 'off');
  input.setSelectionRange(1, 7, 'forward');
  fireEvent.select(input);
  expect(status).toHaveTextContent('Line 2, column 4 \u00b7 6 code units selected');
  input.setSelectionRange(1, 7, 'backward');
  fireEvent.keyUp(input, { key: 'ArrowLeft', shiftKey: true });
  expect(status).toHaveTextContent('Line 1, column 2 \u00b7 6 code units selected');
  input.setSelectionRange(9, 9);
  fireEvent.select(input);
  expect(status).toHaveTextContent('Line 3, column 1');
  expect(input).toHaveAccessibleDescription(/Line 3, column 1/);
});

it("updates the position after automatic indentation and block editing", () => {
  render(<Harness initial={'def solve():'}/>);
  const input = screen.getByRole('textbox') as HTMLTextAreaElement;
  input.setSelectionRange(12, 12);
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(screen.getByLabelText('Solution cursor position')).toHaveTextContent('Line 2, column 5');
  fireEvent.click(screen.getByRole('button', { name: 'Indent' }));
  expect(screen.getByLabelText('Solution cursor position')).toHaveTextContent('Line 2, column 9');
});

it("tracks read-only selection and external replacements, including empty code", () => {
  const props = { onChange: vi.fn(), readOnly: true };
  const { rerender } = render(<PlainPythonEditor {...props} value={'one\ntwo'}/>);
  const input = screen.getByRole('textbox') as HTMLTextAreaElement;
  input.setSelectionRange(4, 5);
  fireEvent.select(input);
  expect(screen.getByLabelText('Solution cursor position')).toHaveTextContent('Line 2, column 2 \u00b7 1 code unit selected');
  rerender(<PlainPythonEditor {...props} value=""/>);
  expect(screen.getByLabelText('Solution cursor position')).toHaveTextContent('Line 1, column 1');
  expect(props.onChange).not.toHaveBeenCalled();
});
