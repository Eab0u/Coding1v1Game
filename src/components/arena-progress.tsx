import { hasSubmissionScore } from "../lib/submission-score";

export function ArenaProgress({ score, player = false }: {
  score?: { passed: number; total: number } | null;
  player?: boolean;
}) {
  const id = player ? "player-progress" : "opponent-progress";
  const valid = !!score && hasSubmissionScore(score);
  const full = valid && score.passed === score.total;
  const summary = valid ? `${score.passed} / ${score.total}` : score ? "Score unavailable" : "No judged submission yet";
  return <section className={`arena-progress${valid ? full ? " arena-progress--full" : " arena-progress--partial" : ""}`} aria-label={player ? "Your best progress" : "Opponent progress"}>
    {valid ? <label htmlFor={id}>{player ? "Your" : "Opponent"} best tests passed: {summary}</label>
      : <p>{player ? "Your" : "Opponent"} best tests passed: {summary}</p>}
    {valid && <progress id={id} aria-describedby={`${id}-help`} value={score.passed} max={score.total} />}
    {valid && <span className="badge arena-progress-badge">{full ? "All tests passed" : "Tests remaining"}</span>}
    {score && !valid && <p className="muted">The best test score is unavailable. Wait for the next automatic update to confirm progress.</p>}
    <p className="muted" id={`${id}-help`}>Best judged test count{player ? " across your attempts" : ""}. Later attempts cannot lower it; runtime and submission time break ties.{full ? " Passing every test does not confirm a win. The server confirms the result after the duel ends." : ""}{player ? " This score does not confirm that your current edits were submitted." : ""}</p>
  </section>;
}
