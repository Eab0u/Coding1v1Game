import type { ArenaSnapshot } from "../lib/arena";
import { hasSubmissionScore } from "../lib/submission-score";

export function SubmissionStatus({ submission, phase = "active" }: { submission: ArenaSnapshot["submission"]; phase?: "pending" | "active" | "settling" | "completed" | "cancelled" }) {
  if (!submission) return null;
  const judged = submission.status === "judged";
  const retrying = submission.status === "error";
  const hasScore = judged && hasSubmissionScore(submission);
  const allPassed = hasScore && submission.passed === submission.total;
  const verdictClass = hasScore ? allPassed ? " arena-verdict--passed" : submission.passed === 0 ? " arena-verdict--zero" : " arena-verdict--partial" : "";
  const title = (phase === "completed" || phase === "cancelled") && !hasScore ? "Latest attempt unavailable" : judged ? "Judging complete" : retrying ? "Waiting for sandbox recovery" : submission.status === "queued" ? "Queued for judging" : submission.status === "running" ? "Judging in progress" : "Checking submission status";
  const terminal = phase === "completed" || phase === "cancelled";
  const terminalHelp = phase === "completed" ? "View results for the recorded outcome and score comparison." : "This duel was cancelled. Submissions are closed and no ratings changed.";
  const detail = terminal && !hasScore
    ? `Latest attempt status is not confirmed here. ${terminalHelp}`
    : judged
    ? hasScore
      ? `Latest solution: ${submission.passed} / ${submission.total} tests passed.`
      : "The server marked this attempt as judged, but its test score is unavailable. Wait for the next automatic update to confirm the score."
    : retrying
      ? "Sandbox temporarily unavailable. Your submission will retry; results are waiting."
      : submission.status === "queued"
        ? "The server has your submission. It is waiting for a sandbox worker."
        : submission.status === "running"
          ? "Your solution is being judged. Test counts are available when judging completes."
          : "Waiting for the server to confirm judging progress.";
  return <div className={`arena-verdict${retrying ? " arena-verdict--retry" : ""}${verdictClass}`} role="status" aria-label="Latest submission" aria-atomic="true">
    <span className="eyebrow">Latest submission</span>
    <strong>{title}</strong>
    {hasScore && <span className="badge arena-verdict-badge">{allPassed ? "All tests passed" : submission.passed === 0 ? "No tests passed" : "Some tests failed"}</span>}
    <p>{detail}</p>
    {hasScore && submission.passed === 0 && phase === "active" && <p>Check the function signature and public examples, then submit a corrected solution. Hidden test inputs stay private.</p>}
    {terminal && hasScore && <p>{terminalHelp}</p>}
    {phase === "settling" && <p>Submissions are closed. Waiting for the server to finish judging; no result is confirmed yet.</p>}
    {allPassed && !terminal && <p>Runtime and submission time still break ties. The final result is confirmed after the duel ends.</p>}
    <p className="muted">This describes the latest server-recorded attempt. Your best score and unsent edits are shown separately.</p>
  </div>;
}
