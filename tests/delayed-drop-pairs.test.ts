// @vitest-environment node
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { generateSmallCases, parseProblemDraft } from "../src/lib/problem-pipeline";

const raw = await readFile(new URL("../problems/drafts/delayed-drop-pairs.json", import.meta.url), "utf8");
const draft = parseProblemDraft(JSON.parse(raw));

// Inspect data only. Catalog Python must run exclusively inside the sandbox.
function enumerate(values: number[], tolerance: number) {
  return values.reduce((total, value, i) => total +
    values.slice(i + 1).filter(later => value - later > tolerance).length, 0);
}

// Independent incremental ordered-prefix identity, unlike the recursive reference.
function orderedPrefix(values: number[], tolerance: number) {
  const prefix: number[] = [];
  let total = 0;
  for (const value of values) {
    let lo = 0, hi = prefix.length;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (prefix[mid] <= value + tolerance) lo = mid + 1;
      else hi = mid;
    }
    total += prefix.length - lo;
    prefix.push(value);
    prefix.sort((a, b) => a - b);
  }
  return total;
}

it("parses the original medium draft and independently checks every small fixture", () => {
  expect(draft).toMatchObject({ slug: "delayed-drop-pairs", difficulty: "medium" });
  expect(draft.referenceSolution).not.toBe(draft.bruteForceSolution);
  expect(Buffer.byteLength(raw)).toBeLessThan(4_000_000);
  for (const fixture of [...draft.examples, ...draft.tests.filter(t => !t.benchmark)]) {
    const [values, tolerance] = fixture.args as [number[], number];
    expect(fixture.expected, JSON.stringify(fixture.args)).toBe(enumerate(values, tolerance));
  }
});

it("generates reproducible diverse cases with ties, signs and strict threshold boundaries", () => {
  const cases = generateSmallCases(draft) as [number[], number][];
  expect(cases).toHaveLength(2000);
  expect(cases).toEqual(generateSmallCases(draft));
  expect(new Set(cases.map(c => JSON.stringify(c))).size).toBeGreaterThan(1900);
  expect(cases.some(([a]) => new Set(a).size < a.length)).toBe(true);
  expect(cases.some(([a]) => a.some(n => n < 0) && a.some(n => n > 0))).toBe(true);
  expect(cases.some(([, t]) => t === 0)).toBe(true);
  expect(cases.some(([a, t]) => a.some((x, i) => a.slice(i + 1).includes(x - t)))).toBe(true);
  for (const [values, tolerance] of cases) {
    expect(values.length).toBeGreaterThanOrEqual(1);
    expect(values.length).toBeLessThanOrEqual(30);
    expect(values.every(n => n >= -8 && n <= 8)).toBe(true);
    expect(tolerance >= 0 && tolerance <= 12).toBe(true);
    const answer = enumerate(values, tolerance);
    expect(orderedPrefix(values, tolerance)).toBe(answer);
    expect(enumerate(values.map(n => n + 100), tolerance)).toBe(answer);
    expect(enumerate(values, tolerance + 1)).toBeLessThanOrEqual(answer);
  }
});

it("covers full-size descending, tied and split-level benchmarks with closed-form counts", () => {
  const benchmarks = draft.tests.filter(t => t.benchmark);
  expect(benchmarks).toHaveLength(3);
  expect(benchmarks[0].args).toEqual([Array.from({ length: 100_000 }, (_, i) => 100_000 - i), 0]);
  expect(benchmarks[0].expected).toBe(100_000 * 99_999 / 2);
  expect(benchmarks[1].args).toEqual([Array(100_000).fill(8), 0]);
  expect(benchmarks[1].expected).toBe(0);
  expect(benchmarks[2].args).toEqual([[...Array(50_000).fill(1_000_000), ...Array(50_000).fill(-1_000_000)], 1_000_000]);
  expect(benchmarks[2].expected).toBe(50_000 ** 2);
  expect(benchmarks[2].expected as number).toBeGreaterThan(2 ** 31);
  for (const test of benchmarks) {
    const n = (test.args[0] as number[]).length;
    expect(n * (n - 1) / 2).toBe(4_999_950_000);
  }
});
