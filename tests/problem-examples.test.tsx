import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { ProblemExamples } from "../src/components/problem-examples";

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

it.each([[], null, undefined, [{ input: 1, output: 2 }], [{ args: [], explanation: "Missing output" }]])("preserves legacy or unavailable examples safely: %j", examples => {
  render(<ProblemExamples examples={examples}/>);
  const fallback = screen.getByRole("region", { name: "Problem examples" });
  expect(fallback.textContent).toBe(JSON.stringify(examples, null, 2) ?? "No examples available.");
  expect(fallback).toHaveAttribute("tabindex", "0");
});
