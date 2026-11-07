import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { ProblemExamples } from "../src/components/problem-examples";

it("explains JSON values and the Python function contract without changing example data", () => {
  render(<ProblemExamples examples={[{ args: [true, false, null], expected: null, explanation: "Nullable result." }]}/>);
  const guide = screen.getByRole("complementary", { name: "Example format guide" });
  expect(guide.querySelector("details")).not.toHaveAttribute("open");
  expect(guide.querySelector("summary")).toHaveTextContent("Reading these examples");
  expect(guide).toHaveTextContent("true is True, false is False, and null is None");
  expect(guide).toHaveTextContent("one value per function argument, in signature order");
  expect(guide).toHaveTextContent("return its result");
  expect(guide).toHaveTextContent("do not need to read input or print the answer");
  expect(JSON.parse(screen.getByRole("region", { name: "Example 1 input" }).textContent!)).toEqual([true, false, null]);
  expect(screen.getByRole("region", { name: "Example 1 expected output" })).toHaveTextContent("null");
});

it("presents ordered arguments, outputs and explanations as separate accessible examples", () => {
  render(<ProblemExamples examples={[
    { args: [[1, 2], 3], expected: false, explanation: "No matching pair." },
    { args: [], expected: null, explanation: "No arguments required." },
  ]}/>);
  const first = within(screen.getByRole("region", { name: "Example 1" }));
  expect(first.getByRole("heading", { name: "Example 1", level: 4 })).toBeVisible();
  expect(JSON.parse(first.getByRole("region", { name: "Example 1 input" }).textContent!)).toEqual([[1, 2], 3]);
  expect(first.getByRole("region", { name: "Example 1 expected output" })).toHaveTextContent("false");
  expect(first.getByText("No matching pair.")).toBeVisible();
  expect(screen.getByRole("region", { name: "Example 2 input" })).toHaveTextContent("[]");
  expect(screen.getByRole("region", { name: "Example 2 expected output" })).toHaveTextContent("null");
  for (const pre of document.querySelectorAll("pre")) expect(pre).toHaveAttribute("tabindex", "0");
});

it("renders explanation markup as text", () => {
  render(<ProblemExamples examples={[{ args: ["<b>input</b>"], expected: 0, explanation: "<script>alert(1)</script>" }]}/>);
  expect(screen.getByText("<script>alert(1)</script>")).toBeVisible();
  expect(document.querySelector("script, b")).toBeNull();
});

it("replaces the unavailable notice when public examples arrive and restores it when removed", () => {
  const { rerender } = render(<ProblemExamples examples={[]}/>);
  rerender(<ProblemExamples examples={[{ args: [0], expected: 0, explanation: "Zero stays zero." }]}/>);
  expect(screen.queryByRole("complementary", { name: "Problem examples unavailable" })).not.toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Example 1 input" })).toHaveTextContent("0");
  rerender(<ProblemExamples examples={null}/>);
  expect(screen.getByRole("complementary", { name: "Problem examples unavailable" })).toBeVisible();
  expect(screen.queryByRole("region", { name: "Example 1" })).not.toBeInTheDocument();
});

it.each([[], null, undefined])("explains unavailable public examples without raw storage values: %j", examples => {
  render(<ProblemExamples examples={examples}/>);
  const notice = screen.getByRole("complementary", { name: "Problem examples unavailable" });
  expect(notice).toHaveClass("example-format-guide");
  expect(notice).toHaveTextContent("No public examples available");
  expect(notice).toHaveTextContent("statement, constraints and function signature");
  expect(notice).toHaveTextContent("Hidden tests still determine correctness");
  expect(notice).toHaveTextContent("Return your result from the function");
  expect(screen.queryByRole("region")).not.toBeInTheDocument();
  expect(screen.queryByRole("complementary", { name: "Example format guide" })).not.toBeInTheDocument();
});

it.each([[{ input: 1, output: 2 }], [{ args: [], explanation: "Missing output" }]])("preserves legacy examples safely: %j", examples => {
  render(<ProblemExamples examples={examples}/>);
  const fallback = screen.getByRole("region", { name: "Problem examples" });
  expect(screen.queryByRole("complementary", { name: "Example format guide" })).not.toBeInTheDocument();
  expect(fallback.textContent).toBe(JSON.stringify(examples, null, 2) ?? "No examples available.");
  expect(fallback).toHaveAttribute("tabindex", "0");
});
