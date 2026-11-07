// @vitest-environment node
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { generateSmallCases, parseProblemDraft } from "../src/lib/problem-pipeline";

const raw = await readFile(new URL("../problems/drafts/relay-balance-window.json", import.meta.url), "utf8");
const draft = parseProblemDraft(JSON.parse(raw));

// Trusted test helpers inspect data only; catalog Python never executes locally.
function enumerateWindows(values: number[], target: number) {
  let longest = 0;
  for (let start = 0; start < values.length; start++) {
    let sum = 0;
    for (let end = start; end < values.length; end++) {
      sum += values[end];
      if (sum === target) longest = Math.max(longest, end - start + 1);
    }
  }
  return longest;
}

it("loads the original draft through the publication parser and verifies every small fixture", () => {
  expect(draft).toMatchObject({ slug: "relay-balance-window", difficulty: "medium" });
  expect(draft.referenceSolution).not.toBe(draft.bruteForceSolution);
  expect(Buffer.byteLength(raw)).toBeLessThan(4_000_000);
  for (const fixture of [...draft.examples, ...draft.tests.filter(test => !test.benchmark)]) {
    const [values, target] = fixture.args as [number[], number];
    expect(fixture.expected, JSON.stringify(fixture.args)).toBe(enumerateWindows(values, target));
  }
});

it("provides deterministic random comparisons with signed values, zeroes and both target signs", () => {
  const cases = generateSmallCases(draft) as [number[], number][];
  expect(cases).toHaveLength(2000);
  expect(cases).toEqual(generateSmallCases(draft));
  expect(new Set(cases.map(args => JSON.stringify(args))).size).toBeGreaterThan(1900);
  expect(cases.some(([a]) => a.includes(0))).toBe(true);
  expect(cases.some(([a]) => a.some(n => n < 0) && a.some(n => n > 0))).toBe(true);
  expect(cases.some(([, target]) => target < 0)).toBe(true);
  expect(cases.some(([, target]) => target > 0)).toBe(true);
  expect(cases.every(([a, target]) => a.length >= 1 && a.length <= 30 &&
    a.every(n => n >= -8 && n <= 8) && target >= -20 && target <= 20)).toBe(true);
});

it("includes full-size benchmarks with independently derived answers and quadratic work", () => {
  const benchmarks = draft.tests.filter(test => test.benchmark);
  expect(benchmarks).toHaveLength(3);
  const [zeros, alternating, positive] = benchmarks;
  expect(zeros.args).toEqual([Array(100_000).fill(0), 1]);
  expect(zeros.expected).toBe(0); // A zero-only window cannot sum to one.
  expect(alternating.args).toEqual([Array.from({ length: 100_000 }, (_, i) => i % 2 ? -1_000_000 : 1_000_000), 0]);
  expect(alternating.expected).toBe(100_000); // The entire even-length record cancels.
  expect(positive.args).toEqual([Array(100_000).fill(1_000_000), 1_000_000]);
  expect(positive.expected).toBe(1); // Only singletons have the target sum.
  for (const { args } of benchmarks) {
    const n = (args[0] as number[]).length;
    expect(n * (n + 1) / 2).toBeGreaterThan(5_000_000_000);
  }
  expect((positive.args[0] as number[]).reduce((sum, n) => sum + n, 0)).toBeGreaterThan(2 ** 31);
});
