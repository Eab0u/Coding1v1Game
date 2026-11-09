// @vitest-environment node
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { generateSmallCases, parseProblemDraft } from "../src/lib/problem-pipeline";

const raw = await readFile(new URL("../problems/drafts/buffered-signal-gain.json", import.meta.url), "utf8");
const draft = parseProblemDraft(JSON.parse(raw));
// Trusted data-only oracles; neither authored Python solution executes on the host.
function enumerate(a: number[]) {
  const gains: number[] = [];
  for (let i = 0; i < a.length; i++)
    for (let j = i + 2; j < a.length; j++) gains.push(a[j] - a[i]);
  return Math.max(...gains);
}
function suffixOracle(a: number[]) {
  let largest = a[a.length - 1];
  let best = -Infinity;
  for (let i = a.length - 3; i >= 0; i--) {
    largest = Math.max(largest, a[i + 2]);
    best = Math.max(best, largest - a[i]);
  }
  return best;
}
it("parses the draft and checks every authored fixture independently", () => {
  expect(draft).toMatchObject({ slug: "buffered-signal-gain", difficulty: "easy" });
  expect(Buffer.byteLength(raw)).toBeLessThan(4_000_000);
  expect(draft.referenceSolution).not.toBe(draft.bruteForceSolution);
  for (const fixture of [...draft.examples, ...draft.tests.filter(t => !t.benchmark)]) {
    const a = fixture.args[0] as number[];
    expect(fixture.expected, JSON.stringify(a)).toBe(enumerate(a));
    expect(suffixOracle(a)).toBe(fixture.expected);
  }
});
it("provides deterministic signed cases and checks pair order, spacing and invariants", () => {
  const cases = generateSmallCases(draft) as [number[]][];
  expect(cases).toHaveLength(2000);
  expect(cases).toEqual(generateSmallCases(draft));
  expect(new Set(cases.map(c => JSON.stringify(c))).size).toBeGreaterThan(1800);
  expect(cases.some(([a]) => enumerate(a) < 0)).toBe(true);
  expect(cases.some(([a]) => a.includes(0))).toBe(true);
  for (const [a] of cases) {
    expect(a.length >= 3 && a.length <= 20 && a.every(n => n >= -8 && n <= 8)).toBe(true);
    const expected = enumerate(a);
    expect(suffixOracle(a)).toBe(expected);
    expect(enumerate(a.map(n => n + 17))).toBe(expected);
    expect(enumerate(a.map(n => n * 3))).toBe(expected * 3);
    expect(enumerate(a.toReversed().map(n => -n))).toBe(expected);
  }
});
it("includes full-size rising, falling and flat benchmarks with quadratic baseline work", () => {
  const benchmarks = draft.tests.filter(t => t.benchmark);
  expect(benchmarks).toHaveLength(3);
  expect(benchmarks.map(t => t.expected)).toEqual([99999, -2, 0]);
  expect(benchmarks.map(t => t.args[0])).toEqual([
    Array.from({ length: 100000 }, (_, i) => i),
    Array.from({ length: 100000 }, (_, i) => 100000 - i),
    Array(100000).fill(-1000000),
  ]);
  for (const t of benchmarks) {
    const a = t.args[0] as number[];
    expect(suffixOracle(a)).toBe(t.expected);
    expect((a.length - 1) * (a.length - 2) / 2).toBe(4999850001);
  }
});
