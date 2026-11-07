/** Server-owned, final judge results for two submissions to the same test suite. */
export interface ScoredSubmission {
  testsPassed: number;
  testsTotal: number;
  /** CPU milliseconds for the largest-test suite in each of exactly three runs.
   * Include the CPU limit for a timed-out test; never use wall-clock duration.
   */
  largestTestsCpuMs: readonly [number, number, number];
  /** Server-recorded milliseconds since match start, never a client timestamp. */
  submittedAtMs: number;
}

export interface MatchScore {
  winner: "playerOne" | "playerTwo" | null;
  reason: "correctness" | "runtime" | "submissionTime" | "draw";
  playerOneCpuMs: number;
  playerTwoCpuMs: number;
}

function nonnegativeFinite(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function validate(submission: ScoredSubmission): void {
  if (
    !Number.isSafeInteger(submission.testsTotal) || submission.testsTotal <= 0 ||
    !Number.isSafeInteger(submission.testsPassed) || submission.testsPassed < 0 ||
    submission.testsPassed > submission.testsTotal ||
    !nonnegativeFinite(submission.submittedAtMs) ||
    !Array.isArray(submission.largestTestsCpuMs) ||
    submission.largestTestsCpuMs.length !== 3 ||
    !Array.from(submission.largestTestsCpuMs).every(nonnegativeFinite)
  ) {
    throw new RangeError("Scoring requires valid counts, a submission time and three finite nonnegative CPU samples.");
  }
}

/** Median of three, without mutating the judge's samples. */
function median(samples: readonly number[]): number {
  return [...samples].sort((a, b) => a - b)[1];
}

/** Compare finalized submissions. Call only with trusted judge/server data.
 * Both submissions must use the same hidden tests and largest-test benchmark.
 * Match lifecycle, no-shows and choosing a player's submission belong to the caller.
 */
export function scoreMatch(one: ScoredSubmission, two: ScoredSubmission): MatchScore {
  validate(one);
  validate(two);
  if (one.testsTotal !== two.testsTotal) {
    throw new RangeError("Submissions must use the same hidden test suite.");
  }
  const playerOneCpuMs = median(one.largestTestsCpuMs);
  const playerTwoCpuMs = median(two.largestTestsCpuMs);
  const base = { playerOneCpuMs, playerTwoCpuMs };
  if (one.testsPassed !== two.testsPassed) {
    return { ...base, winner: one.testsPassed > two.testsPassed ? "playerOne" : "playerTwo", reason: "correctness" };
  }
  if (playerOneCpuMs !== playerTwoCpuMs) {
    return { ...base, winner: playerOneCpuMs < playerTwoCpuMs ? "playerOne" : "playerTwo", reason: "runtime" };
  }
  if (one.submittedAtMs !== two.submittedAtMs) {
    return { ...base, winner: one.submittedAtMs < two.submittedAtMs ? "playerOne" : "playerTwo", reason: "submissionTime" };
  }
  return { ...base, winner: null, reason: "draw" };
}
