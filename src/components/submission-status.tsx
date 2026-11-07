import type { ArenaSnapshot } from "../lib/arena";

export function SubmissionStatus({ submission }: { submission: ArenaSnapshot["submission"] }) {
  if (!submission) return null;
  const judged = submission.status === "judged";
  const retrying = submission.status === "error";
  const hasScore = judged && Number.isSafeInteger(submission.passed) && Number.isSafeInteger(submission.total)
    && submission.passed !== null && submission.total !== null
    && submission.total > 0 && submission.passed >= 0 && submission.passed <= submission.total;
  const allPassed = hasScore && submission.passed === submission.total;
  const verdictClass = hasScore ? allPassed ? " arena-verdict--passed" : " arena-verdict--partial" : "";
  const title = judged ? "Judging complete" : retrying ? "Waiting for sandbox recovery" : submission.status === "queued" ? "Queued for judging" : submission.status === "running" ? "Judging in progress" : "Checking submission status";
  const detail = judged
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
    {hasScore && <span className="badge arena-verdict-badge">{allPassed ? "All tests passed" : "Some tests failed"}</span>}
    <p>{detail}</p>
    {allPassed && <p>Runtime and submission time still break ties. The final result is confirmed after the duel ends.</p>}
    <p className="muted">This describes the latest server-recorded attempt. Your best score and unsent edits are shown separately.</p>
  </div>;
}
