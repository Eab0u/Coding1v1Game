import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
const captured = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));
vi.mock("monaco-editor", () => ({}));
vi.mock("@monaco-editor/react", () => ({
  loader: { config: vi.fn() },
  default: (props: Record<string, unknown>) => {
    captured.props = props;
    return <div aria-label="Advanced editor fixture"/>;
  },
}));
import PythonEditor from "../src/components/python-editor";

it.each([false, true])("keeps advanced editor keyboard navigation available (readOnly=%s)", readOnly => {
  const change = vi.fn();
  const { rerender } = render(<PythonEditor value="def solve():\n    pass" onChange={change} readOnly={readOnly}/>);
  expect(screen.getByText(/Tab and Shift\+Tab move between controls/)).toHaveTextContent(readOnly
    ? "Select text and use Ctrl+C or Cmd+C to copy it."
    : "To indent code, use Ctrl+] or Cmd+]; to outdent, use Ctrl+[ or Cmd+[.");
  expect(captured.props.options).toMatchObject({ tabFocusMode: true, readOnly, tabSize: 4 });
  rerender(<PythonEditor value="updated" onChange={change} readOnly={!readOnly} wordWrap fontSize={18}/>);
  expect(captured.props.options).toMatchObject({ tabFocusMode: true, readOnly: !readOnly, wordWrap: "on", fontSize: 18 });
  expect(captured.props.value).toBe("updated");
  const onChange = captured.props.onChange as (value?: string) => void;
  onChange("new solution");
  expect(change).toHaveBeenLastCalledWith("new solution");
  onChange(undefined);
  expect(change).toHaveBeenLastCalledWith("");
});

it("updates read-only guidance without remounting the advanced editor or changing code", () => {
  const change = vi.fn();
  const props = { value: "valuable solution", onChange: change, fontSize: 19, wordWrap: true };
  const view = render(<PythonEditor {...props} readOnly={false}/>);
  const editor = screen.getByLabelText("Advanced editor fixture");
  editor.tabIndex = 0;
  editor.focus();
  expect(screen.queryByRole("note", { name: "Read-only solution" })).not.toBeInTheDocument();
  view.rerender(<PythonEditor {...props} readOnly/>);
  expect(screen.getByRole("note", { name: "Read-only solution" })).toHaveClass("editor-readonly-notice");
  expect(screen.getByText(/Select text and use Ctrl\+C/)).toHaveTextContent("Copy solution or Download solution below");
  expect(screen.queryByText(/To indent code/)).not.toBeInTheDocument();
  expect(screen.getByLabelText("Advanced editor fixture")).toBe(editor);
  expect(editor).toHaveFocus();
  expect(captured.props).toMatchObject({ value: props.value, options: { readOnly: true, fontSize: 19, wordWrap: "on" } });
  view.rerender(<PythonEditor {...props} readOnly={false}/>);
  expect(screen.queryByRole("note", { name: "Read-only solution" })).not.toBeInTheDocument();
  expect(screen.getByText(/To indent code/)).toBeInTheDocument();
  expect(editor).toHaveFocus();
  expect(change).not.toHaveBeenCalled();
});
