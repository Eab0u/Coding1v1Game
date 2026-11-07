import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { SubmissionStatus } from "../src/components/submission-status";

it.each([0, 3, 8])("distinguishes a judged score of %i without implying a duel victory", passed => {
  render(<SubmissionStatus submission={{ status: "judged", passed, total: 8 }} />);
  const panel = screen.getByRole("status", { name: "Latest submission" });
  expect(panel).toHaveAttribute("aria-atomic", "true");
  expect(panel).toHaveTextContent(`Latest solution: ${passed} / 8 tests passed.`);
  expect(panel).toHaveTextContent(passed === 8 ? "All tests passed" : "Some tests failed");
  expect(panel).toHaveClass(passed === 8 ? "arena-verdict--passed" : "arena-verdict--partial");
  expect(panel).toHaveTextContent("Your best score and unsent edits are shown separately");
  if (passed === 8) expect(panel).toHaveTextContent("Runtime and submission time still break ties");
});

it.each(["queued", "running", "error", "unknown"])("withholds verdict badges for %s attempts even with worker counts", status => {
  render(<SubmissionStatus submission={{ status, passed: 8, total: 8 }} />);
  const panel = screen.getByRole("status", { name: "Latest submission" });
  expect(panel.querySelector(".arena-verdict-badge")).toBeNull();
  expect(panel).not.toHaveTextContent("Latest solution:");
});

it.each([{ passed: null, total: null }, { passed: 0, total: 0 }])("does not label unavailable scores as passing: %j", score => {
  render(<SubmissionStatus submission={{ status: "judged", ...score }} />);
  expect(screen.getByRole("status").querySelector(".arena-verdict-badge")).toBeNull();
});

it("clears the previous verdict when a new attempt queues", () => {
  const { rerender } = render(<SubmissionStatus submission={{ status: "judged", passed: 8, total: 8 }} />);
  rerender(<SubmissionStatus submission={{ status: "queued", passed: null, total: null }} />);
  expect(screen.queryByText("All tests passed")).toBeNull();
  expect(screen.getByRole("status")).not.toHaveClass("arena-verdict--passed");
  rerender(<SubmissionStatus submission={null} />);
  expect(screen.queryByRole("status")).toBeNull();
});
