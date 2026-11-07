import type { DuelResult } from "./results";
import { hasSubmissionScore } from "./submission-score";

/** Explain persisted metrics only when they agree with the authoritative outcome. */
export function explainResult(result: DuelResult): string {
  const unavailable = "A detailed scoring explanation is unavailable for this match.";
  if (result.players.length !== 2) return unavailable;
  const [you, opponent] = result.players;
  const valid = (n: number | null): n is number => n !== null && Number.isFinite(n) && n >= 0;
  if (![you, opponent].every(p => hasSubmissionScore(p) && valid(p.cpu)) || you.total !== opponent.total) return unavailable;
  let comparison: number;
  let reason: string;
  if (you.passed !== opponent.passed) {
    comparison = you.passed! - opponent.passed!;
    reason = "passed more hidden tests. Correctness takes priority over runtime and submission time.";
  } else if (you.cpu !== opponent.cpu) {
    comparison = opponent.cpu! - you.cpu!;
    reason = "had the lower median benchmark CPU time. Hidden test counts were tied; CPU time takes priority over submission time.";
  } else if (valid(you.submitted) && valid(opponent.submitted) && you.submitted !== opponent.submitted) {
    comparison = opponent.submitted - you.submitted;
    reason = "submitted earlier. Hidden test counts and median benchmark CPU time were tied.";
  } else if (you.submitted === opponent.submitted && (you.submitted === null || valid(you.submitted))) {
    return result.outcome === "DRAW"
      ? you.submitted === null
        ? "Neither player had a judged submission. The match is a draw."
        : "Hidden test counts, median benchmark CPU time and submission time were all tied. The match is a draw."
      : unavailable;
  } else return unavailable;
  if ((comparison > 0 ? "WIN" : "LOSS") !== result.outcome) return unavailable;
  return `${comparison > 0 ? "You" : "Your opponent"} ${reason}`;
}
