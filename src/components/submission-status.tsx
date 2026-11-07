import type { ArenaSnapshot } from "../lib/arena";

export function SubmissionStatus({ submission }: { submission: ArenaSnapshot["submission"] }) {
  if (!submission) return null;
  const judged = submission.status === "judged";
  const retrying = submission.status === "error";
  const title = judged ? "Judging complete" : retrying ? "Waiting for sandbox recovery" : submission.status === "queued" ? "Queued for judging" : submission.status === "running" ? "Judging in progress" : "Checking submission status";
  const detail = judged
    ? `Latest solution: ${submission.passed} / ${submission.total} tests passed.`
    : retrying
      ? "Sandbox temporarily unavailable. Your submission will retry; results are waiting."
      : submission.status === "queued"
        ? "The server has your submission. It is waiting for a sandbox worker."
        : submission.status === "running"
          ? "Your solution is being judged. Test counts are available when judging completes."
          : "Waiting for the server to confirm judging progress.";
  return <div className={`arena-verdict${retrying ? " arena-verdict--retry" : ""}`} role="status" aria-label="Latest submission" aria-atomic="true">
    <span className="eyebrow">Latest submission</span>
    <strong>{title}</strong>
    <p>{detail}</p>
    <p className="muted">This describes the latest server-recorded attempt. Your best score and unsent edits are shown separately.</p>
  </div>;
}
