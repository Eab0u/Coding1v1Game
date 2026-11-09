import { hasSubmissionScore } from "../lib/submission-score";

export function ArenaProgress({ score, player = false, phase = "active" }: {
  score?: { passed: number; total: number } | null;
  player?: boolean;
  phase?: "pending" | "active" | "settling" | "completed" | "cancelled";
}) {
  const id = player ? "player-progress" : "opponent-progress";
  const valid = !!score && hasSubmissionScore(score);
  const full = valid && score.passed === score.total;
  const terminal = phase === "completed" || phase === "cancelled";
  const scoreHelp = phase === "completed" ? "View results for the recorded outcome, score comparison and rating changes."
    : phase === "cancelled" ? "This duel was cancelled. Submissions are closed and no ratings changed."
    : phase === "settling" ? "Submissions are closed. Already submitted attempts may still be judged; no result is confirmed yet. Runtime and submission time break ties."
    : "Later attempts cannot lower it; runtime and submission time break ties.";
  const summary = valid ? `${score.passed} / ${score.total}` : score ? "Score unavailable" : "No judged submission yet";
  const emptyHelp = phase === "pending" ? "The duel has not started. Best judged scores appear after activation and submission."
    : phase === "settling" ? "Submissions are closed. Waiting for the server to finish judging; no result is confirmed yet."
    : phase === "completed" ? "No judged score is shown here. View results for the recorded outcome and score comparison."
    : phase === "cancelled" ? "This duel was cancelled. Submissions are closed and no ratings changed."
    : player ? "Submit your solution when ready. Your best judged score will appear here." : "Their best judged score will appear here after they submit. Keep working on your solution.";
  const unavailableHelp = phase === "completed" ? "The best test score is unavailable here. View results for the recorded outcome and score comparison."
    : phase === "cancelled" ? "The best test score is unavailable. This duel was cancelled; no ratings changed."
    : "The best test score is unavailable. Wait for the next automatic update to confirm progress.";
  return <section className={`arena-progress${valid ? full ? " arena-progress--full" : score.passed === 0 ? " arena-progress--zero" : " arena-progress--partial" : score ? " arena-progress--unavailable" : " arena-progress--empty"}`} aria-label={player ? "Your best progress" : "Opponent progress"}>
    <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">{player ? "Your" : "Opponent"} best progress: {valid ? `${score.passed} of ${score.total} hidden tests passed.` : `${summary}.`}</span>
    {valid ? <label htmlFor={id}>{player ? "Your" : "Opponent"} best tests passed: {summary}</label>
      : <div className="arena-progress-placeholder"><p className="arena-progress-eyebrow">{player ? "Your" : "Opponent"} best tests passed</p><p className="arena-progress-summary">{summary}</p></div>}
    {!score && <p className="arena-progress-next">{emptyHelp}</p>}
    {valid && <progress id={id} aria-describedby={`${id}-help`} aria-valuetext={`${score.passed} of ${score.total} hidden tests passed`} value={score.passed} max={score.total} />}
    {valid && <span className="badge arena-progress-badge">{full ? "All tests passed" : score.passed === 0 ? "No tests passed" : "Tests remaining"}</span>}
    {score && !valid && <p className="muted">{unavailableHelp}</p>}
    {valid && <p className="muted" id={`${id}-help`}>Best judged test count{player ? " across your attempts" : ""}. {scoreHelp}{full && !terminal ? " Passing every test does not confirm a win. The server confirms the result after the duel ends." : ""}{player ? " This score does not confirm that your current edits were submitted." : ""}</p>}
  </section>;
}
