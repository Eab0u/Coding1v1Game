import { hasSubmissionScore } from "../lib/submission-score";

export function ArenaProgress({ score, player = false }: {
  score?: { passed: number; total: number } | null;
  player?: boolean;
}) {
  const id = player ? "player-progress" : "opponent-progress";
  const valid = !!score && hasSubmissionScore(score);
  const full = valid && score.passed === score.total;
  const summary = valid ? `${score.passed} / ${score.total}` : score ? "Score unavailable" : "No judged submission yet";
  return <section className={`arena-progress${valid ? full ? " arena-progress--full" : score.passed === 0 ? " arena-progress--zero" : " arena-progress--partial" : score ? " arena-progress--unavailable" : " arena-progress--empty"}`} aria-label={player ? "Your best progress" : "Opponent progress"}>
    <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">{player ? "Your" : "Opponent"} best progress: {valid ? `${score.passed} of ${score.total} hidden tests passed.` : `${summary}.`}</span>
    {valid ? <label htmlFor={id}>{player ? "Your" : "Opponent"} best tests passed: {summary}</label>
      : <div className="arena-progress-placeholder"><p className="arena-progress-eyebrow">{player ? "Your" : "Opponent"} best tests passed</p><p className="arena-progress-summary">{summary}</p></div>}
    {!score && <p className="arena-progress-next">{player ? "Submit your solution when ready. Your best judged score will appear here." : "Their best judged score will appear here after they submit. Keep working on your solution."}</p>}
    {valid && <progress id={id} aria-describedby={`${id}-help`} aria-valuetext={`${score.passed} of ${score.total} hidden tests passed`} value={score.passed} max={score.total} />}
    {valid && <span className="badge arena-progress-badge">{full ? "All tests passed" : score.passed === 0 ? "No tests passed" : "Tests remaining"}</span>}
    {score && !valid && <p className="muted">The best test score is unavailable. Wait for the next automatic update to confirm progress.</p>}
    {valid && <p className="muted" id={`${id}-help`}>Best judged test count{player ? " across your attempts" : ""}. Later attempts cannot lower it; runtime and submission time break ties.{full ? " Passing every test does not confirm a win. The server confirms the result after the duel ends." : ""}{player ? " This score does not confirm that your current edits were submitted." : ""}</p>}
  </section>;
}
