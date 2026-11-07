import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { expect, it, vi } from "vitest";
import { PlainPythonEditor } from "../src/components/plain-python-editor";

function Harness({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  return <PlainPythonEditor value={value} onChange={setValue} readOnly={false}/>;
}

it.each([
  ['text = """\n    if ready:', "    "],
  ["text = '''\n    if ready:", "    "],
  ['text = """\n# not a comment\n    if ready:', "    "],
  ['text = """\n    escaped \\"""\n    if ready:', "    "],
  ['text = """\nbody\n"""\nif ready:', "    "],
  ["text = '''\nbody\n'''\nif ready:", "    "],
  ['# """ ignored\nif ready:', "    "],
  ['text = "# triple: \\\""\nif ready:', "    "],
  ['items = [\n    if ready:', "    "],
  ['items = [\n    1\n]\nif ready:', "    "],
  ['text = """\nbody\n"""\n    if ready:', "        "],
  ['if (\n    ready\n):', "    "],
  ['# unmatched [ ignored\n    if ready: # comment', "        "],
])("uses earlier-line lexical context for Enter: %s", (prefix, indentation) => {
  render(<Harness initial={prefix + "replace suffix"}/>);
  const input = screen.getByRole("textbox") as HTMLTextAreaElement;
  input.focus();
  input.setSelectionRange(prefix.length, prefix.length + 7, "backward");
  fireEvent.keyDown(input, { key: "Enter" });
  expect(input).toHaveValue(prefix + "\n" + indentation + " suffix");
  expect(input.selectionStart).toBe(prefix.length + 1 + indentation.length);
  expect(input.selectionEnd).toBe(input.selectionStart);
  expect(input).toHaveFocus();
});

it.each(["compositionend", "blur"])("preserves IME selection through Select all code and recovers after %s", ending => {
  const change = vi.fn();
  const value = "    first\n    second";
  const { rerender } = render(<PlainPythonEditor value={value} onChange={change} readOnly={false}/>);
  const input = screen.getByRole("textbox") as HTMLTextAreaElement;
  input.focus();
  input.setSelectionRange(2, 15, "backward");
  fireEvent.select(input);
  const feedback = screen.getByRole("group", { name: "Solution cursor position" }).textContent;
  fireEvent.compositionStart(input);
  for (const readOnly of [false, true, false]) {
    rerender(<PlainPythonEditor value={value} onChange={change} readOnly={readOnly}/>);
    expect(fireEvent.mouseDown(screen.getByRole("button", { name: "Select all code" }))).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Select all code" }));
    expect(input).toHaveValue(value);
    expect(input).toHaveFocus();
    expect(input.selectionStart).toBe(2);
    expect(input.selectionEnd).toBe(15);
    expect(input.selectionDirection).toBe("backward");
    expect(screen.getByRole("group", { name: "Solution cursor position" })).toHaveTextContent(feedback!);
  }
  if (ending === "compositionend") fireEvent.compositionEnd(input);
  else input.blur();
  fireEvent.click(screen.getByRole("button", { name: "Select all code" }));
  expect(input).toHaveFocus();
  expect(input.selectionStart).toBe(0);
  expect(input.selectionEnd).toBe(value.length);
  expect(input.selectionDirection).toBe("forward");
  expect(screen.getByRole("group", { name: "Solution cursor position" })).toHaveTextContent(`${value.length} code units selected across 2 lines`);
  expect(change).not.toHaveBeenCalled();
});

it.each(["compositionend", "blur"])("protects toolbar indentation during IME and recovers after %s", ending => {
  render(<Harness initial={"    first\n    second"}/>);
  const input = screen.getByRole("textbox") as HTMLTextAreaElement;
  input.focus();
  input.setSelectionRange(2, 15, "backward");
  fireEvent.select(input);
  const feedback = screen.getByRole("group", { name: "Solution cursor position" }).textContent;
  fireEvent.compositionStart(input);
  for (const name of ["Indent", "Outdent", "Indent", "Outdent"]) {
    const button = screen.getByRole("button", { name });
    // Simulate the browser's default focus transfer only when mousedown allows it.
    const transferFocus = fireEvent.mouseDown(button);
    if (transferFocus) button.focus();
    expect(transferFocus).toBe(false);
    fireEvent.mouseUp(button);
    fireEvent.click(button);
    expect(input).toHaveValue("    first\n    second");
    expect(input.selectionStart).toBe(2);
    expect(input.selectionEnd).toBe(15);
    expect(input.selectionDirection).toBe("backward");
    expect(input).toHaveFocus();
    expect(screen.getByRole("group", { name: "Solution cursor position" })).toHaveTextContent(feedback!);
  }
  if (ending === "compositionend") fireEvent.compositionEnd(input);
  else { input.blur(); input.focus(); }
  expect(fireEvent.mouseDown(screen.getByRole("button", { name: "Indent" }))).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Indent" }));
  expect(input).toHaveValue("        first\n        second");
  expect(input.selectionDirection).toBe("backward");
  fireEvent.click(screen.getByRole("button", { name: "Outdent" }));
  expect(input).toHaveValue("    first\n    second");
  expect(input.selectionStart).toBe(2);
  expect(input.selectionEnd).toBe(15);
});

it.each([false, true])("keeps solution size accurate without disturbing selections (readOnly=%s)", readOnly => {
  const change = vi.fn();
  const { rerender } = render(<PlainPythonEditor value="" onChange={change} readOnly={readOnly}/>);
  const input = screen.getByRole("textbox") as HTMLTextAreaElement;
  for (const [value, lines, units] of [["", 1, 0], ["x", 1, 1], ["x\n", 2, 2], ["\n\n", 3, 2], ["😀\ne\u0301", 2, 5], ["x\ny\nz", 3, 5]] as const) {
    rerender(<PlainPythonEditor value={value} onChange={change} readOnly={readOnly}/>);
    input.focus();
    input.setSelectionRange(0, value.length, "backward");
    fireEvent.select(input);
    expect(screen.getByLabelText("Solution size")).toHaveTextContent(`${lines} ${lines === 1 ? "line" : "lines"} · ${units} UTF-16 code ${units === 1 ? "unit" : "units"}.`);
    expect(input).toHaveAccessibleDescription(/An empty draft has one line; a trailing newline starts another/);
    rerender(<PlainPythonEditor value={value} onChange={change} readOnly={!readOnly} wordWrap fontSize={18}/>);
    expect(input).toHaveFocus();
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(value.length);
    expect(input.selectionDirection).toBe("backward");
    expect(input).toHaveValue(value);
  }
  expect(change).not.toHaveBeenCalled();
});

it("refreshes solution size after typing and indentation", () => {
  render(<Harness initial="x"/>);
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "x\ny" } });
  expect(screen.getByLabelText("Solution size")).toHaveTextContent("2 lines · 3 UTF-16 code units");
  fireEvent.click(screen.getByRole("button", { name: "Indent" }));
  expect(screen.getByLabelText("Solution size")).toHaveTextContent("2 lines · 7 UTF-16 code units");
  fireEvent.click(screen.getByRole("button", { name: "Outdent" }));
  expect(screen.getByLabelText("Solution size")).toHaveTextContent("2 lines · 3 UTF-16 code units");
});

it.each([false, true])("selects the current whole solution for manual copying without edits (readOnly=%s)", readOnly => {
  const change = vi.fn();
  const initial = "def solve():\n    return '😀'";
  const { rerender } = render(<PlainPythonEditor value={initial} onChange={change} readOnly={readOnly}/>);
  const input = screen.getByRole("textbox") as HTMLTextAreaElement;
  const select = screen.getByRole("button", { name: "Select all code" });
  expect(select).toHaveAttribute("type", "button");
  expect(input).toHaveAccessibleDescription(/Select all code.*whole solution/);
  for (const value of [initial, "x\ny", "", initial]) {
    rerender(<PlainPythonEditor value={value} onChange={change} readOnly={readOnly}/>);
    input.setSelectionRange(0, Math.min(2, value.length), "backward");
    select.focus();
    fireEvent.click(select);
    expect(input).toHaveFocus();
    expect(input).toHaveValue(value);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(value.length);
    expect(input).toHaveAccessibleDescription(new RegExp(`Line ${value.split("\n").length}, column ${value.length - value.lastIndexOf("\n")}`));
    for (const event of [{ key: "c", ctrlKey: true }, { key: "c", metaKey: true }, { key: "Tab" }]) {
      expect(fireEvent.keyDown(input, event)).toBe(true);
    }
  }
  expect(change).not.toHaveBeenCalled();
});

it("updates read-only guidance without replacing the draft, selection or focus", () => {
  const change = vi.fn();
  const value = "def solve():\n    return 1";
  const { rerender } = render(<PlainPythonEditor value={value} onChange={change} readOnly={false}/>);
  const input = screen.getByRole("textbox") as HTMLTextAreaElement;
  input.focus();
  input.setSelectionRange(4, 9, "backward");
  expect(screen.queryByRole("note")).not.toBeInTheDocument();
  expect(input).toHaveAccessibleDescription(/Enter keeps indentation/);

  for (let attempt = 0; attempt < 2; attempt++) {
    rerender(<PlainPythonEditor value={value} onChange={change} readOnly/>);
    expect(screen.getByRole("note")).toHaveTextContent("Read-only solution. You can select and copy your code.");
    expect(input).toHaveAttribute("readonly");
    expect(input).toHaveAccessibleDescription(/read-only.*Ctrl\+C or Cmd\+C.*Tab moves/);
    expect(input).not.toHaveAccessibleDescription(/Enter keeps indentation/);
    for (const event of [{ key: "c", ctrlKey: true }, { key: "c", metaKey: true }, { key: "Tab" }, { key: "Enter" }, { key: "]", ctrlKey: true }]) {
      expect(fireEvent.keyDown(input, event)).toBe(true);
    }
    expect(input).toHaveValue(value);
    expect(input.selectionStart).toBe(4);
    expect(input.selectionEnd).toBe(9);
    expect(input.selectionDirection).toBe("backward");
    expect(input).toHaveFocus();
    expect(screen.getByRole("button", { name: "Indent" })).toBeDisabled();
    rerender(<PlainPythonEditor value={value} onChange={change} readOnly={false}/>);
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
    expect(input).not.toHaveAttribute("readonly");
    expect(input).toHaveAccessibleDescription(/Enter keeps indentation/);
    expect(screen.getByRole("button", { name: "Indent" })).toBeEnabled();
  }
  expect(change).not.toHaveBeenCalled();
});

it.each([false, true])("preserves native Enter during composition without keyboard flags (readOnly=%s)", readOnly => {
  const change = vi.fn();
  render(<PlainPythonEditor value="def solve():" onChange={change} readOnly={readOnly}/>);
  const input = screen.getByRole("textbox") as HTMLTextAreaElement;
  input.focus();
  input.setSelectionRange(4, 9, "backward");
  fireEvent.compositionStart(input);
  for (let attempt = 0; attempt < 2; attempt++) {
    expect(fireEvent.keyDown(input, { key: "Enter", keyCode: 13, isComposing: false })).toBe(true);
    expect(input).toHaveValue("def solve():");
    expect(input.selectionStart).toBe(4);
    expect(input.selectionEnd).toBe(9);
    expect(input.selectionDirection).toBe("backward");
    expect(input).toHaveFocus();
  }
  expect(change).not.toHaveBeenCalled();
});

it.each(["compositionend", "blur"])("resumes indentation after composition clears through %s", ending => {
  render(<Harness initial="def solve():"/>);
  const input = screen.getByRole("textbox") as HTMLTextAreaElement;
  input.focus();
  input.setSelectionRange(12, 12);
  fireEvent.compositionStart(input);
  expect(fireEvent.keyDown(input, { key: "Enter" })).toBe(true);
  if (ending === "compositionend") fireEvent.compositionEnd(input);
  else { input.blur(); input.focus(); }
  expect(fireEvent.keyDown(input, { key: "Enter" })).toBe(false);
  expect(input).toHaveValue("def solve():\n    ");
  expect(input.selectionStart).toBe(17);
  expect(input).toHaveFocus();
  fireEvent.compositionStart(input);
  expect(fireEvent.keyDown(input, { key: "Enter" })).toBe(true);
  expect(input).toHaveValue("def solve():\n    ");
});

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

it.each(['forward', 'backward'] as const)('preserves %s active selection through repeated indent and outdent', direction => {
  render(<Harness initial={'one\ntwo\nthree'}/>);
  const input = screen.getByRole('textbox') as HTMLTextAreaElement;
  input.setSelectionRange(1, 8, direction);
  for (const [action, start, end, column] of [
    ['Indent', 5, 16, 6], ['Indent', 9, 24, 10],
    ['Outdent', 5, 16, 6], ['Outdent', 1, 8, 2],
  ] as const) {
    fireEvent.click(screen.getByRole('button', { name: action }));
    expect(input).toHaveFocus();
    expect(input.selectionStart).toBe(start);
    expect(input.selectionEnd).toBe(end);
    expect(input.selectionDirection).toBe(direction);
    expect(screen.getByLabelText('Solution cursor position')).toHaveTextContent(
      direction === 'backward' ? `Line 1, column ${column}` : 'Line 3, column 1',
    );
  }
  expect(input).toHaveValue('one\ntwo\nthree');
});

it('preserves backward selection when outdent changes no text', () => {
  const change = vi.fn();
  render(<PlainPythonEditor value={'one\ntwo'} onChange={change} readOnly={false}/>);
  const input = screen.getByRole('textbox') as HTMLTextAreaElement;
  input.setSelectionRange(1, 6, 'backward');
  fireEvent.click(screen.getByRole('button', { name: 'Outdent' }));
  expect(input).toHaveFocus();
  expect(input.selectionDirection).toBe('backward');
  expect(input.selectionStart).toBe(1);
  expect(input.selectionEnd).toBe(6);
  expect(change).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Solution cursor position')).toHaveTextContent('Line 1, column 2');
});


it.each([false, true])("preserves IME confirmation Enter when isComposing is false (readOnly=%s)", readOnly => {
  const change = vi.fn();
  render(<PlainPythonEditor value="def solve():" onChange={change} readOnly={readOnly}/>);
  const input = screen.getByRole("textbox") as HTMLTextAreaElement;
  input.focus();
  input.setSelectionRange(4, 9, "backward");
  // Some IMEs report their confirmation key as 229 after isComposing clears.
  expect(fireEvent.keyDown(input, { key: "Enter", keyCode: 229, isComposing: false })).toBe(true);
  expect(change).not.toHaveBeenCalled();
  expect(input).toHaveValue("def solve():");
  expect(input.selectionStart).toBe(4);
  expect(input.selectionEnd).toBe(9);
  expect(input.selectionDirection).toBe("backward");
  expect(input).toHaveFocus();
});

it("resumes automatic indentation on the next ordinary Enter after IME confirmation", () => {
  render(<Harness initial="def solve():"/>);
  const input = screen.getByRole("textbox") as HTMLTextAreaElement;
  input.focus();
  input.setSelectionRange(12, 12);
  expect(fireEvent.keyDown(input, { key: "Enter", keyCode: 229 })).toBe(true);
  expect(input).toHaveValue("def solve():");
  expect(fireEvent.keyDown(input, { key: "Enter", keyCode: 13 })).toBe(false);
  expect(input).toHaveValue("def solve():\n    ");
  expect(input.selectionStart).toBe(17);
  expect(input.selectionEnd).toBe(17);
  expect(input).toHaveFocus();
});
it.each(["ctrlKey", "metaKey"])("supports %s indentation shortcuts with backward block selections", modifier => {
  render(<Harness initial={"one\ntwo\nthree"}/>);
  const input = screen.getByRole("textbox") as HTMLTextAreaElement;
  input.focus();
  input.setSelectionRange(0, 8, "backward");
  for (let attempt = 0; attempt < 2; attempt++) {
    expect(fireEvent.keyDown(input, { key: "]", [modifier]: true })).toBe(false);
    expect(input).toHaveValue("    one\n    two\nthree");
    expect([input.selectionStart, input.selectionEnd, input.selectionDirection]).toEqual([4, 16, "backward"]);
    expect(input).toHaveFocus();
    expect(fireEvent.keyDown(input, { key: "[", [modifier]: true })).toBe(false);
    expect(input).toHaveValue("one\ntwo\nthree");
    expect([input.selectionStart, input.selectionEnd, input.selectionDirection]).toEqual([0, 8, "backward"]);
  }
  expect(input).toHaveAccessibleDescription(/Ctrl\+\] or Cmd\+\] indents/);
});

it.each([
  { key: "]" }, { key: "[" }, { key: "]", ctrlKey: true, altKey: true },
  { key: "[", metaKey: true, shiftKey: true }, { key: "]", ctrlKey: true, isComposing: true },
  { key: "[", metaKey: true, keyCode: 229 },
])("leaves unrelated or composing bracket keys native: %j", event => {
  const change = vi.fn();
  render(<PlainPythonEditor value="    code" onChange={change} readOnly={false}/>);
  expect(fireEvent.keyDown(screen.getByRole("textbox"), event)).toBe(true);
  expect(change).not.toHaveBeenCalled();
});

it.each([false, true])("protects composing and read-only drafts from shortcuts (readOnly=%s)", readOnly => {
  const change = vi.fn();
  render(<PlainPythonEditor value="    code" onChange={change} readOnly={readOnly}/>);
  const input = screen.getByRole("textbox") as HTMLTextAreaElement;
  input.setSelectionRange(1, 7, "backward");
  fireEvent.compositionStart(input);
  for (const key of ["[", "]"]) {
    expect(fireEvent.keyDown(input, { key, ctrlKey: true })).toBe(true);
    expect([input.selectionStart, input.selectionEnd, input.selectionDirection]).toEqual([1, 7, "backward"]);
  }
  expect(change).not.toHaveBeenCalled();
  fireEvent.compositionEnd(input);
  expect(fireEvent.keyDown(input, { key: "]", metaKey: true })).toBe(readOnly);
  expect(change).toHaveBeenCalledTimes(readOnly ? 0 : 1);
});

it.each([false, true])("reports selection line scope without changing selections (readOnly=%s)", readOnly => {
  const change = vi.fn();
  render(<PlainPythonEditor value={"ab\ncd\nef\n"} onChange={change} readOnly={readOnly}/>);
  const input = screen.getByRole("textbox") as HTMLTextAreaElement;
  const position = screen.getByLabelText("Solution cursor position");
  input.focus();
  for (const direction of ["forward", "backward"] as const) {
    for (const [start, end, lines] of [[0, 1, 1], [0, 3, 1], [1, 4, 2], [0, 6, 2], [0, 9, 3], [2, 3, 1], [3, 6, 1], [2, 7, 3]]) {
      input.setSelectionRange(start, end, direction);
      fireEvent.select(input);
      expect(position).toHaveTextContent(`${end - start} code unit${end - start === 1 ? "" : "s"} selected across ${lines} line${lines === 1 ? "" : "s"}`);
      expect(input.selectionStart).toBe(start);
      expect(input.selectionEnd).toBe(end);
      expect(input.selectionDirection).toBe(direction);
      expect(input).toHaveFocus();
    }
  }
  fireEvent.click(screen.getByRole("button", { name: "Select all code" }));
  expect(position).toHaveTextContent("9 code units selected across 3 lines");
  input.setSelectionRange(9, 9);
  fireEvent.select(input);
  expect(position).toHaveTextContent("Line 4, column 1");
  expect(position).not.toHaveTextContent("selected across");
  expect(change).not.toHaveBeenCalled();
});

it("updates selected line counts after indentation and draft replacement", () => {
  const { rerender } = render(<Harness initial={"ab\ncd\nef"}/>);
  const input = screen.getByRole("textbox") as HTMLTextAreaElement;
  input.setSelectionRange(0, 6, "backward");
  fireEvent.click(screen.getByRole("button", { name: "Indent" }));
  expect(screen.getByLabelText("Solution cursor position")).toHaveTextContent("10 code units selected across 2 lines");
  fireEvent.click(screen.getByRole("button", { name: "Outdent" }));
  expect(screen.getByLabelText("Solution cursor position")).toHaveTextContent("6 code units selected across 2 lines");
  rerender(<PlainPythonEditor value="x" onChange={vi.fn()} readOnly/>);
  expect(screen.getByLabelText("Solution cursor position")).not.toHaveTextContent("selected across");
});

it.each([
  ["    'key':", "    "],
  ["    items[1:", "    "],
  ["    value:", "    "],
  ["    iffy:", "    "],
  ["    async_value:", "    "],
  ...["if ready", "elif ready", "else", "for item in items", "while ready", "try", "except ValueError", "except* ValueError", "finally", "with lock", "def solve(x)", "class Solver", "match value", "case 1", "async def solve(x)", "async for item in items", "async with lock"].map(header => [`    ${header}: # block`, "        "]),
  ["    # explain:", "    "],
  ["    value = 1 # note:", "    "],
  ["    if ready: # proceed", "        "],
  ["    if ready: # note:", "        "],
  ['    if marker == "#": # proceed', "        "],
  ["    if marker == '#':", "        "],
  ['    text = "unfinished:', "    "],
  ['    text = "escaped\\\"#:', "    "],
  ["\tif ready: # proceed", "\t    "],
])("indents Enter using code rather than comment colons: %s", (initial, indentation) => {
  render(<Harness initial={initial}/>);
  const input = screen.getByRole("textbox") as HTMLTextAreaElement;
  input.focus();
  input.setSelectionRange(initial.length, initial.length);
  expect(fireEvent.keyDown(input, { key: "Enter" })).toBe(false);
  expect(input).toHaveValue(initial + "\n" + indentation);
  expect(input.selectionStart).toBe(initial.length + 1 + indentation.length);
  expect(input.selectionEnd).toBe(input.selectionStart);
  expect(input).toHaveFocus();
});

it("replaces a selection after a commented block header and preserves the suffix", () => {
  const initial = "if ready: # proceed REMOVE\nnext_call()";
  render(<Harness initial={initial}/>);
  const input = screen.getByRole("textbox") as HTMLTextAreaElement;
  const start = initial.indexOf(" REMOVE");
  input.focus();
  input.setSelectionRange(start, start + 7, "backward");
  fireEvent.keyDown(input, { key: "Enter" });
  expect(input).toHaveValue("if ready: # proceed\n    \nnext_call()");
  expect(input.selectionStart).toBe(start + 5);
  expect(input.selectionEnd).toBe(start + 5);
});

it("splits a dictionary entry without block indentation and preserves its selected suffix", () => {
  const initial = "    'key': REMOVEvalue";
  render(<Harness initial={initial}/>);
  const input = screen.getByRole("textbox") as HTMLTextAreaElement;
  const start = initial.indexOf(" REMOVE");
  input.focus();
  input.setSelectionRange(start, start + 7, "backward");
  fireEvent.keyDown(input, { key: "Enter" });
  expect(input).toHaveValue("    'key':\n    value");
  expect(input.selectionStart).toBe(start + 5);
  expect(input.selectionEnd).toBe(start + 5);
  expect(input).toHaveFocus();
});

it.each([
  ["    if values[1:", "    "],
  ["    for value in {'key':", "    "],
  ["    if check({'key':", "    "],
  ["    if (ready:", "    "],
  ["    if values[(1]:", "    "],
  ["    if ready):", "    "],
  ["    if values[1:]:", "        "],
  ["    if check({'key': [1, 2]}): # proceed", "        "],
  ['    if marker == "([{}])":', "        "],
  ["    if ready: # ([{", "        "],
  ['    if """unfinished":', "    "],
  ["    if '''unfinished':", "    "],
  ['    if """unfinished"":', "    "],
  ["    if '''unfinished'':", "    "],
  ['    if """closed""":', "        "],
  ["    if '''closed''':", "        "],
  ['    if """# ([{ " quoted""": # comment', "        "],
  ["    if '''# )]} ' quoted''':", "        "],
  ['    if """escaped\\""":', "    "],
  ['    if """escaped\\" then closed""":', "        "],
])("only adds block indentation outside balanced delimiters: %s", (initial, indentation) => {
  render(<Harness initial={initial + "REMOVEtail"}/>);
  const input = screen.getByRole("textbox") as HTMLTextAreaElement;
  input.focus();
  input.setSelectionRange(initial.length, initial.length + 6, "backward");
  expect(fireEvent.keyDown(input, { key: "Enter" })).toBe(false);
  expect(input).toHaveValue(initial + "\n" + indentation + "tail");
  expect(input.selectionStart).toBe(initial.length + 1 + indentation.length);
  expect(input.selectionEnd).toBe(input.selectionStart);
  expect(input).toHaveFocus();
});
