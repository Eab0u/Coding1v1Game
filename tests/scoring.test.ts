import { describe, expect, it } from "vitest";
import { scoreMatch, type ScoredSubmission } from "../src/lib/scoring";

const submission = (overrides: Partial<ScoredSubmission> = {}): ScoredSubmission => ({
  testsPassed: 8, testsTotal: 10, largestTestsCpuMs: [10, 20, 30], submittedAtMs: 1000,
  ...overrides,
});

describe("match scoring", () => {
  it.each([
    [submission({ testsPassed: 9, largestTestsCpuMs: [100, 100, 100], submittedAtMs: 2000 }), submission(), "correctness"],
    [submission({ largestTestsCpuMs: [1, 2, 3], submittedAtMs: 2000 }), submission(), "runtime"],
    [submission({ submittedAtMs: 999 }), submission(), "submissionTime"],
  ] as const)("awards each tiebreak in both player positions", (winner, loser, reason) => {
    expect(scoreMatch(winner, loser)).toMatchObject({ winner: "playerOne", reason });
    expect(scoreMatch(loser, winner)).toMatchObject({ winner: "playerTwo", reason });
  });

  it("uses the numeric median, ignores outliers and preserves inputs", () => {
    const one = submission({ largestTestsCpuMs: Object.freeze([1000, 9, 10]) });
    const two = submission({ largestTestsCpuMs: [11, 11, 0] });
    expect(scoreMatch(one, two)).toEqual({ winner: "playerOne", reason: "runtime", playerOneCpuMs: 10, playerTwoCpuMs: 11 });
    expect(one.largestTestsCpuMs).toEqual([1000, 9, 10]);
  });

  it.each([0, 8, 10])("draws when all criteria tie at %i passes", (testsPassed) => {
    expect(scoreMatch(submission({ testsPassed }), submission({ testsPassed }))).toMatchObject({ winner: null, reason: "draw" });
  });

  it("compares fractional CPU times without rounding and accepts zero", () => {
    expect(scoreMatch(submission({ largestTestsCpuMs: [0, 0, 0] }), submission({ largestTestsCpuMs: [0.001, 0.001, 0.001] })).winner).toBe("playerOne");
  });

  it("uses submission time when differently ordered CPU samples have equal medians", () => {
    expect(scoreMatch(submission({ largestTestsCpuMs: [30, 10, 20], submittedAtMs: 0 }), submission())).toMatchObject({ winner: "playerOne", reason: "submissionTime" });
  });

  it.each([
    { testsPassed: -1 }, { testsPassed: 11 }, { testsPassed: 1.5 }, { testsPassed: NaN },
    { testsTotal: 0 }, { testsTotal: Infinity }, { testsTotal: 1.5 },
    { submittedAtMs: -1 }, { submittedAtMs: NaN }, { submittedAtMs: Infinity },
    { largestTestsCpuMs: [1, 2] }, { largestTestsCpuMs: [1, 2, 3, 4] },
    { largestTestsCpuMs: [1, -1, 2] }, { largestTestsCpuMs: [1, NaN, 2] },
    { largestTestsCpuMs: [1, Infinity, 2] }, { largestTestsCpuMs: new Array(3) },
  ])("rejects invalid input on either side: %j", (invalid) => {
    const bad = submission(invalid as Partial<ScoredSubmission>);
    expect(() => scoreMatch(bad, submission())).toThrow(RangeError);
    expect(() => scoreMatch(submission(), bad)).toThrow(RangeError);
  });

  it("rejects different test totals before choosing a winner", () => {
    expect(() => scoreMatch(submission(), submission({ testsTotal: 11 }))).toThrow(/same hidden test suite/);
  });
});
