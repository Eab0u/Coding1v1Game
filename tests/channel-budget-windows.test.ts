// @vitest-environment node
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { generateSmallCases, parseProblemDraft } from "../src/lib/problem-pipeline";

const raw = await readFile(new URL("../problems/drafts/channel-budget-windows.json", import.meta.url), "utf8");
const draft = parseProblemDraft(JSON.parse(raw));

// Data-only oracle: enumerate intervals independently of the Python algorithms.
function enumerate(values: number[], budget: number) {
  let total = 0;
  for (let start = 0; start < values.length; start++) {
    for (let end = start + 1; end <= values.length; end++) {
      if (new Set(values.slice(start, end)).size <= budget) total++;
    }
  }
  return total;
}

it("parses the medium draft and verifies authored small answers", () => {
  expect(draft).toMatchObject({ slug: "channel-budget-windows", difficulty: "medium" });
  expect(draft.referenceSolution).not.toBe(draft.bruteForceSolution);
  expect(Buffer.byteLength(raw)).toBeLessThan(4_000_000);
  for (const test of [...draft.examples, ...draft.tests.filter(t => !t.benchmark)]) {
    expect(test.expected, JSON.stringify(test.args)).toBe(enumerate(test.args[0] as number[], test.args[1] as number));
  }
});

it("generates deterministic bounded cases covering shrinking and excess budgets", () => {
  const cases = generateSmallCases(draft) as [number[], number][];
  expect(cases).toHaveLength(2000);
  expect(cases).toEqual(generateSmallCases(draft));
  expect(new Set(cases.map(c => JSON.stringify(c))).size).toBeGreaterThan(1700);
  expect(cases.some(([a, k]) => new Set(a).size > k)).toBe(true);
  expect(cases.some(([a, k]) => new Set(a).size < k)).toBe(true);
  expect(cases.some(([a]) => a.length === 1)).toBe(true);
  expect(cases.some(([a]) => a.includes(0) && a.some(v => v < 0) && a.some(v => v > 0))).toBe(true);
  for (const [values, budget] of cases) {
    expect(values.length >= 1 && values.length <= 30).toBe(true);
    expect(values.every(v => Number.isInteger(v) && v >= -3 && v <= 3)).toBe(true);
    expect(budget >= 1 && budget <= 9).toBe(true);
    const answer = enumerate(values, budget);
    expect(answer).toBeGreaterThanOrEqual(values.length);
    expect(answer).toBeLessThanOrEqual(values.length * (values.length + 1) / 2);
    expect(enumerate([...values].reverse(), budget)).toBe(answer);
    expect(enumerate(values, budget + 1)).toBeGreaterThanOrEqual(answer);
  }
});

it("provides large dense, distinct and repeated-shrink benchmarks", () => {
  const benchmarks = draft.tests.filter(t => t.benchmark);
  expect(benchmarks).toHaveLength(3);
  expect(benchmarks[0].args).toEqual([Array(100000).fill(0), 1]);
  expect(benchmarks[0].expected).toBe(100000 * 100001 / 2);
  expect(benchmarks[0].expected).toBeGreaterThan(2 ** 31 - 1);
  expect(benchmarks[1].args).toEqual([Array.from({ length: 100000 }, (_, i) => i), 1]);
  expect(benchmarks[1].expected).toBe(100000);
  expect(benchmarks[2].args).toEqual([Array.from({ length: 100000 }, (_, i) => i % 3), 2]);
  expect(benchmarks[2].expected).toBe(100000 + 99999);
  for (const test of benchmarks) {
    const n = (test.args[0] as number[]).length;
    expect(n * (n + 1) / 2).toBe(5_000_050_000);
  }
});
