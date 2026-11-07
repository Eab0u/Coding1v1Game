// @vitest-environment node
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { generateSmallCases, parseProblemDraft } from "../src/lib/problem-pipeline";

const raw = await readFile(new URL("../problems/drafts/relay-cooldown-score.json", import.meta.url), "utf8");
const draft = parseProblemDraft(JSON.parse(raw));

// Trusted data-only oracles. Catalog Python is never executed on the host.
function enumerate(values: number[], position = 0): number {
  if (position >= values.length) return 0;
  return Math.max(enumerate(values, position + 1), values[position] + enumerate(values, position + 2));
}

function pathScore(values: number[]) {
  let idle = 0;
  let active = -Infinity;
  for (const value of values) {
    const nextActive = idle + value;
    idle = Math.max(idle, active);
    active = nextActive;
  }
  return Math.max(idle, active);
}

it("parses the easy dynamic-programming draft and verifies small authored answers", () => {
  expect(draft).toMatchObject({ slug: "relay-cooldown-score", difficulty: "easy" });
  expect(draft.topics).toContain("dynamic programming");
  expect(draft.referenceSolution).not.toBe(draft.bruteForceSolution);
  expect(Buffer.byteLength(raw)).toBeLessThan(4_000_000);
  for (const fixture of [...draft.examples, ...draft.tests.filter(test => !test.benchmark)]) {
    expect(fixture.expected).toBe(enumerate(fixture.args[0] as number[]));
  }
});

it("cross-checks 2000 seeded records against exhaustive choices and score properties", () => {
  const cases = generateSmallCases(draft) as [number[]][];
  expect(cases).toHaveLength(2000);
  expect(cases).toEqual(generateSmallCases(draft));
  expect(cases.some(([a]) => a.length === 1)).toBe(true);
  expect(cases.some(([a]) => a.every(n => n < 0))).toBe(true);
  expect(cases.some(([a]) => a.includes(0) && a.some(n => n < 0) && a.some(n => n > 0))).toBe(true);
  for (const [values] of cases) {
    expect(values.length >= 1 && values.length <= 16).toBe(true);
    expect(values.every(n => Number.isInteger(n) && Math.abs(n) <= 8)).toBe(true);
    const answer = enumerate(values);
    expect(pathScore(values)).toBe(answer);
    expect(pathScore([...values].reverse())).toBe(answer);
    expect(pathScore(values.map(n => n * 3))).toBe(answer * 3);
    expect(answer).toBeGreaterThanOrEqual(Math.max(0, ...values));
    expect(answer).toBeLessThanOrEqual(values.reduce((sum, n) => sum + Math.max(0, n), 0));
  }
});

it("covers full-size positive, negative and alternating benchmarks with closed-form answers", () => {
  const benchmarks = draft.tests.filter(test => test.benchmark);
  expect(benchmarks).toHaveLength(3);
  expect(benchmarks[0].args[0]).toEqual(Array(100_000).fill(1_000_000));
  expect(benchmarks[1].args[0]).toEqual(Array(100_000).fill(-1_000_000));
  expect(benchmarks[2].args[0]).toEqual(Array.from({ length: 100_000 }, (_, i) => i % 2 ? -1_000_000 : 1_000_000));
  expect(benchmarks.map(test => test.expected)).toEqual([50_000_000_000, 0, 50_000_000_000]);
  for (const fixture of [...draft.examples, ...draft.tests]) {
    const values = fixture.args[0] as number[];
    expect(values.length >= 1 && values.length <= 100_000).toBe(true);
    expect(values.every(n => Number.isInteger(n) && Math.abs(n) <= 1_000_000)).toBe(true);
    expect(fixture.expected).toBe(pathScore(values));
  }
  // The supplied quadratic solution scans every compatible previous endpoint,
  // even for negative records: (n-1)(n-2)/2 comparisons per full benchmark.
  expect(99_999 * 99_998 / 2).toBe(4_999_850_001);
});
