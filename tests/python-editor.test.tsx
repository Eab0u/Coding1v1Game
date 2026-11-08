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
  expect(screen.getByText(/Tab and Shift\+Tab move between controls/)).toHaveTextContent("To indent code, use Ctrl+] or Cmd+]; to outdent, use Ctrl+[ or Cmd+[.");
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
