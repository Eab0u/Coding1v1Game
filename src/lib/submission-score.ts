/** A verdict requires complete, internally consistent server test counts. */
export function hasSubmissionScore(score: { passed: number | null; total: number | null }): score is { passed: number; total: number } {
  return Number.isSafeInteger(score.passed) && Number.isSafeInteger(score.total)
    && score.passed !== null && score.total !== null
    && score.total > 0 && score.passed >= 0 && score.passed <= score.total;
}
