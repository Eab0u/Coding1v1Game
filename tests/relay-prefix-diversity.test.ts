// @vitest-environment node
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { generateSmallCases, parseProblemDraft } from "../src/lib/problem-pipeline";

const raw = await readFile(new URL("../problems/drafts/relay-prefix-diversity.json", import.meta.url), "utf8");
const draft = parseProblemDraft(JSON.parse(raw));

// Trusted data-only oracles; draft Python never executes on the host.
function enumerate(a: number[]) {
  return a.reduce((sum, _, i) => sum + new Set(a.slice(0, i + 1)).size, 0);
}

// Each ID contributes once to every prefix starting at its first occurrence.
function contributions(a: number[]) {
  const first = new Map<number, number>();
  a.forEach((v, i) => { if (!first.has(v)) first.set(v, i); });
  return [...first.values()].reduce((sum, i) => sum + a.length - i, 0);
}

it("parses the original draft and verifies examples and edge fixtures", () => {
  expect(draft).toMatchObject({ slug: "relay-prefix-diversity", difficulty: "easy" });
  expect(draft.referenceSolution).not.toBe(draft.bruteForceSolution);
  expect(Buffer.byteLength(raw)).toBeLessThan(4_000_000);
  for (const t of [...draft.examples, ...draft.tests.filter(t => !t.benchmark)]) {
    expect(enumerate(t.args[0] as number[])).toBe(t.expected);
  }
});

it("checks 2000 seeded cases against first-occurrence contributions and renaming invariance", () => {
  const cases = generateSmallCases(draft) as [number[]][];
  expect(cases).toHaveLength(2000);
  expect(cases).toEqual(generateSmallCases(draft));
  expect(cases.some(([a]) => a.length === 1)).toBe(true);
  expect(cases.some(([a]) => new Set(a).size < a.length)).toBe(true);
  expect(cases.some(([a]) => a.includes(0) && a.some(v => v < 0))).toBe(true);
  for (const [a] of cases) {
    expect(a.length).toBeGreaterThanOrEqual(1);
    expect(a.length).toBeLessThanOrEqual(30);
    expect(a.every(v => v >= -8 && v <= 8)).toBe(true);
    const expected = enumerate(a);
    expect(contributions(a)).toBe(expected);
    expect(enumerate(a.map(v => 3 * v + 7))).toBe(expected);
    expect(enumerate([...a, a[0]])).toBe(expected + new Set(a).size);
  }
});

it("verifies full-size benchmark formulas and wide answers", () => {
  const benchmarks = draft.tests.filter(t => t.benchmark);
  expect(benchmarks).toHaveLength(3);
  expect(benchmarks.map(t => t.expected)).toEqual([100_000, 5_000_050_000, 199_999]);
  expect(benchmarks[0].args).toEqual([Array(100_000).fill(0)]);
  expect(benchmarks[1].args).toEqual([Array.from({ length: 100_000 }, (_, i) => i)]);
  expect(benchmarks[2].args).toEqual([Array.from({ length: 100_000 }, (_, i) => i % 2)]);
  for (const t of benchmarks) {
    const a = t.args[0] as number[];
    expect(contributions(a)).toBe(t.expected);
    expect(a.length * (a.length + 1) / 2).toBe(5_000_050_000);
  }
  expect(benchmarks[1].expected).toBeGreaterThan(2 ** 31);
});
