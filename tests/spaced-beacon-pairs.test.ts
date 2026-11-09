// @vitest-environment node
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { generateSmallCases, parseProblemDraft } from "../src/lib/problem-pipeline";

const raw = await readFile(new URL("../problems/drafts/spaced-beacon-pairs.json", import.meta.url), "utf8");
const draft = parseProblemDraft(JSON.parse(raw));

// Trusted data-only oracle: all equal pairs minus neighboring equal pairs.
// Neither catalog Python solution is executed on the host.
function countPairs(values: number[]) {
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  let result = [...counts.values()].reduce((sum, n) => sum + n * (n - 1) / 2, 0);
  for (let i = 1; i < values.length; i++) if (values[i] === values[i - 1]) result--;
  return result;
}

it("parses the easy draft and independently verifies every authored answer", () => {
  expect(draft).toMatchObject({ slug: "spaced-beacon-pairs", difficulty: "easy" });
  expect(draft.referenceSolution).not.toBe(draft.bruteForceSolution);
  expect(Buffer.byteLength(raw)).toBeLessThan(4_000_000);
  for (const fixture of [...draft.examples, ...draft.tests]) {
    const values = fixture.args[0] as number[];
    expect(values.length).toBeGreaterThanOrEqual(1);
    expect(values.length).toBeLessThanOrEqual(100_000);
    expect(values.every(n => Number.isInteger(n) && Math.abs(n) <= 1_000_000)).toBe(true);
    expect(fixture.expected).toBe(countPairs(values));
  }
});

it("covers adjacency, shared positions, signed channels and deterministic small inputs", () => {
  const cases = generateSmallCases(draft) as [number[]][];
  expect(cases).toHaveLength(2000);
  expect(cases).toEqual(generateSmallCases(draft));
  expect(new Set(cases.map(args => JSON.stringify(args))).size).toBeGreaterThan(1700);
  expect(cases.some(([a]) => a.length === 1)).toBe(true);
  expect(cases.some(([a]) => a.some((n, i) => i > 0 && n === a[i - 1]))).toBe(true);
  expect(cases.some(([a]) => a.includes(0) && a.some(n => n < 0) && a.some(n => n > 0))).toBe(true);
  for (const [values] of cases) {
    expect(values.length >= 1 && values.length <= 30).toBe(true);
    expect(values.every(n => n >= -4 && n <= 4)).toBe(true);
    let enumerated = 0;
    for (let i = 0; i < values.length; i++) {
      for (let j = i + 2; j < values.length; j++) if (values[i] === values[j]) enumerated++;
    }
    expect(countPairs(values)).toBe(enumerated);
  }
});

it("provides full-size benchmarks for dense, interleaved and absent matches", () => {
  const benchmarks = draft.tests.filter(test => test.benchmark);
  expect(benchmarks).toHaveLength(3);
  expect(benchmarks[0].args[0]).toEqual(Array(100_000).fill(0));
  expect(benchmarks[0].expected).toBeGreaterThan(2 ** 31 - 1);
  expect(benchmarks[1].args[0]).toEqual(Array.from({ length: 100_000 }, (_, i) => i % 2 ? -1_000_000 : 1_000_000));
  expect(new Set(benchmarks[2].args[0] as number[]).size).toBe(100_000);
  for (const test of benchmarks) {
    const n = (test.args[0] as number[]).length;
    expect(n).toBe(100_000);
    expect((n - 1) * (n - 2) / 2).toBeGreaterThan(4_999_000_000);
  }
});
