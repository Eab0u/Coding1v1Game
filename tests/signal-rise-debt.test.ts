// @vitest-environment node
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { generateSmallCases, parseProblemDraft } from "../src/lib/problem-pipeline";

const raw = await readFile(new URL("../problems/drafts/signal-rise-debt.json", import.meta.url), "utf8");
const draft = parseProblemDraft(JSON.parse(raw));

// Trusted fixture oracle only. Catalog Python is never executed on the host.
function enumerateDebt(values: number[]) {
  return values.reduce((sum, value, i) => {
    const offset = values.slice(i + 1).findIndex(later => later > value);
    return sum + (offset < 0 ? 0 : offset + 1);
  }, 0);
}

it("parses the original medium draft and independently checks small answers", () => {
  expect(draft).toMatchObject({ slug: "signal-rise-debt", difficulty: "medium" });
  expect(draft.referenceSolution).not.toBe(draft.bruteForceSolution);
  expect(Buffer.byteLength(raw)).toBeLessThan(4_000_000);
  for (const fixture of [...draft.examples, ...draft.tests.filter(t => !t.benchmark)]) {
    expect(fixture.expected, JSON.stringify(fixture.args)).toBe(enumerateDebt(fixture.args[0] as number[]));
  }
  expect(enumerateDebt([3, 1, 1, 4])).toBe(6); // Equal levels remain unresolved.
  expect(enumerateDebt([2, 5, 3, 6])).toBe(4); // Use the first greater tick.
});

it("generates reproducible comparisons with ties, negative levels and singletons", () => {
  const cases = generateSmallCases(draft) as [number[]][];
  expect(cases).toHaveLength(2000);
  expect(cases).toEqual(generateSmallCases(draft));
  expect(new Set(cases.map(args => JSON.stringify(args))).size).toBeGreaterThan(1700);
  expect(cases.some(([a]) => a.length === 1)).toBe(true);
  expect(cases.some(([a]) => a.some((n, i) => i > 0 && a[i - 1] === n))).toBe(true);
  expect(cases.some(([a]) => a.includes(0) && a.some(n => n < 0) && a.some(n => n > 0))).toBe(true);
  for (const [values] of cases) {
    expect(values.length >= 1 && values.length <= 30).toBe(true);
    expect(values.every(n => Number.isInteger(n) && Math.abs(n) <= 5)).toBe(true);
  }
});

it("covers full-size unresolved, equal and late-resolution quadratic benchmarks", () => {
  const benchmarks = draft.tests.filter(t => t.benchmark);
  expect(benchmarks).toHaveLength(3);
  const [descending, equal, finalRise] = benchmarks;
  expect(descending.args[0]).toEqual(Array.from({ length: 100_000 }, (_, i) => 100_000 - i));
  expect(equal.args[0]).toEqual(Array(100_000).fill(-1_000_000));
  expect(descending.expected).toBe(0);
  expect(equal.expected).toBe(0);
  expect(finalRise.args[0]).toEqual([...Array.from({ length: 99_999 }, (_, i) => 99_999 - i), 1_000_000]);
  // Every earlier tick first resolves at the final tick: 1 + ... + 99,999.
  expect(finalRise.expected).toBe(100_000 * 99_999 / 2);
  expect(finalRise.expected).toBeGreaterThan(2 ** 31 - 1);
  for (const fixture of [...draft.examples, ...draft.tests]) {
    const values = fixture.args[0] as number[];
    expect(values.length >= 1 && values.length <= 100_000).toBe(true);
    expect(values.every(n => Number.isInteger(n) && Math.abs(n) <= 1_000_000)).toBe(true);
    if ("benchmark" in fixture && fixture.benchmark) expect(values.length * (values.length - 1) / 2).toBeGreaterThan(4_999_000_000);
  }
});
