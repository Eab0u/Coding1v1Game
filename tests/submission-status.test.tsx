import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { SubmissionStatus } from "../src/components/submission-status";

it.each([0, 3, 8])("distinguishes a judged score of %i without implying a duel victory", passed => {
  render(<SubmissionStatus submission={{ status: "judged", passed, total: 8 }} />);
  const panel = screen.getByRole("status", { name: "Latest submission" });
  expect(panel).toHaveAttribute("aria-atomic", "true");
  expect(panel).toHaveTextContent(`Latest solution: ${passed} / 8 tests passed.`);
  expect(panel).toHaveTextContent(passed === 8 ? "All tests passed" : passed === 0 ? "No tests passed" : "Some tests failed");
  expect(panel).toHaveClass(passed === 8 ? "arena-verdict--passed" : passed === 0 ? "arena-verdict--zero" : "arena-verdict--partial");
  expect(panel).toHaveTextContent("Your best score and unsent edits are shown separately");
  if (passed === 8) expect(panel).toHaveTextContent("Runtime and submission time still break ties");
});

it.each(["queued", "running", "error", "unknown"])("withholds verdict badges for %s attempts even with worker counts", status => {
  render(<SubmissionStatus submission={{ status, passed: 8, total: 8 }} />);
  const panel = screen.getByRole("status", { name: "Latest submission" });
  expect(panel.querySelector(".arena-verdict-badge")).toBeNull();
  expect(panel).not.toHaveTextContent("Latest solution:");
});

it.each([
  { passed: null, total: null }, { passed: null, total: 8 }, { passed: 0, total: null },
  { passed: 0, total: 0 }, { passed: -1, total: 8 }, { passed: 9, total: 8 },
  { passed: 1.5, total: 8 }, { passed: 1, total: 8.5 },
  { passed: NaN, total: 8 }, { passed: 1, total: Infinity },
])("explains unavailable judged scores without presenting counts or a verdict: %j", score => {
  render(<SubmissionStatus submission={{ status: "judged", ...score }} />);
  const panel = screen.getByRole("status");
  expect(panel.querySelector(".arena-verdict-badge")).toBeNull();
  expect(panel).not.toHaveTextContent("Latest solution:");
  expect(panel).toHaveTextContent("its test score is unavailable");
  expect(panel).toHaveTextContent("next automatic update");
  expect(panel).not.toHaveClass("arena-verdict--passed", "arena-verdict--partial", "arena-verdict--zero");
});

it("replaces unavailable score guidance when polling supplies a valid score and clears it if the score disappears", () => {
  const { rerender } = render(<SubmissionStatus submission={{ status: "judged", passed: null, total: 8 }} />);
  rerender(<SubmissionStatus submission={{ status: "judged", passed: 8, total: 8 }} />);
  expect(screen.getByRole("status")).toHaveTextContent("All tests passed");
  expect(screen.getByRole("status")).not.toHaveTextContent("score is unavailable");
  rerender(<SubmissionStatus submission={{ status: "judged", passed: 8, total: null }} />);
  expect(screen.getByRole("status")).toHaveTextContent("score is unavailable");
  expect(screen.queryByText("All tests passed")).toBeNull();
  expect(screen.getByRole("status")).not.toHaveTextContent("Runtime and submission time still break ties");
});

it("clears the previous verdict when a new attempt queues", () => {
  const { rerender } = render(<SubmissionStatus submission={{ status: "judged", passed: 8, total: 8 }} />);
  rerender(<SubmissionStatus submission={{ status: "queued", passed: null, total: null }} />);
  expect(screen.queryByText("All tests passed")).toBeNull();
  expect(screen.getByRole("status")).not.toHaveClass("arena-verdict--passed");
  rerender(<SubmissionStatus submission={null} />);
  expect(screen.queryByRole("status")).toBeNull();
});

it("removes zero-pass correction guidance through polling and a newly queued attempt", () => {
  const { rerender } = render(<SubmissionStatus submission={{ status: "judged", passed: 0, total: 8 }} />);
  expect(screen.getByRole("status")).toHaveTextContent("Check the function signature and public examples");
  expect(screen.getByRole("status")).toHaveTextContent("Hidden test inputs stay private");
  for (const submission of [
    { status: "judged", passed: 3, total: 8 },
    { status: "judged", passed: 8, total: 8 },
    { status: "judged", passed: 0, total: 0 },
    { status: "queued", passed: 0, total: 8 },
  ]) {
    rerender(<SubmissionStatus submission={submission} />);
    expect(screen.queryByText("No tests passed")).toBeNull();
    expect(screen.getByRole("status")).not.toHaveClass("arena-verdict--zero");
    expect(screen.queryByText(/Check the function signature and public examples/)).toBeNull();
    rerender(<SubmissionStatus submission={{ status: "judged", passed: 0, total: 8 }} />);
    expect(screen.getByText("No tests passed")).toBeVisible();
    expect(screen.getByRole("status")).toHaveClass("arena-verdict--zero");
  }
});


it.each(["queued", "running", "error", "unknown", "judged"])("retires live latest-attempt promises at closure for %s", status => {
  const submission = { status, passed: null, total: 8 };
  const view = render(<SubmissionStatus submission={submission} />);
  const panel = screen.getByRole("status");
  for (const phase of ["completed", "cancelled"] as const) {
    view.rerender(<SubmissionStatus submission={submission} phase={phase} />);
    expect(screen.getByRole("status")).toBe(panel);
    expect(panel).toHaveTextContent(phase === "completed" ? "View results for the recorded outcome" : "no ratings changed");
    expect(panel).not.toHaveTextContent(/next automatic update|will retry|waiting for a sandbox worker|being judged|submit a corrected/);
    expect(panel.querySelector(".arena-verdict-badge")).toBeNull();
  }
  view.rerender(<SubmissionStatus submission={{status:"judged",passed:0,total:8}} />);
  expect(panel).toHaveTextContent("submit a corrected solution");
});

it.each([0,3,8])("preserves verified %i-test verdicts with phase-appropriate guidance", passed => {
  const submission = {status:"judged",passed,total:8};
  const view = render(<SubmissionStatus submission={submission} />);
  for (const phase of ["pending", "settling", "completed", "cancelled"] as const) {
    view.rerender(<SubmissionStatus submission={submission} phase={phase} />);
    const panel = screen.getByRole("status");
    expect(panel).toHaveTextContent(`Latest solution: ${passed} / 8 tests passed.`);
    expect(panel.querySelector(".arena-verdict-badge")).not.toBeNull();
    expect(panel).not.toHaveTextContent("submit a corrected solution");
    if (phase === "settling") expect(panel).toHaveTextContent("Submissions are closed");
    if (phase === "completed" || phase === "cancelled") expect(panel).not.toHaveTextContent("final result is confirmed after");
  }
});
