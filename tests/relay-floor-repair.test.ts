// @vitest-environment node
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { generateSmallCases, parseProblemDraft } from "../src/lib/problem-pipeline";

const raw = await readFile(new URL("../problems/drafts/relay-floor-repair.json", import.meta.url), "utf8");
const draft = parseProblemDraft(JSON.parse(raw));

// Data-only oracles; authored Python is never executed on the host.
function prefixCost(a: number[]) {
  return a.reduce((sum, value, i) => sum + Math.max(...a.slice(0, i + 1)) - value, 0);
}

// Independently simulate unit repairs on small inputs, preserving each earlier repair.
function repair(a: number[]) {
  const result = [...a];
  let count = 0;
  for (let i = 1; i < result.length; i++) {
    while (result[i] < result[i - 1]) { result[i]++; count++; }
  }
  return count;
}

it("parses the original draft and verifies its public examples and signed edge fixtures", () => {
  expect(draft).toMatchObject({ slug: "relay-floor-repair", difficulty: "easy" });
  expect(draft.referenceSolution).not.toBe(draft.bruteForceSolution);
  expect(Buffer.byteLength(raw)).toBeLessThan(4_000_000);
  for (const t of [...draft.examples, ...draft.tests.filter(t => !t.benchmark)]) {
    expect(prefixCost(t.args[0] as number[])).toBe(t.expected);
  }
});

it("compares 2000 deterministic cases with unit repairs and checks shift and scaling invariants", () => {
  const cases = generateSmallCases(draft) as [number[]][];
  expect(cases).toHaveLength(2000);
  expect(cases).toEqual(generateSmallCases(draft));
  expect(cases.some(([a]) => a.length === 1)).toBe(true);
  expect(cases.some(([a]) => a.includes(0) && a.some(v => v < 0))).toBe(true);
  for (const [a] of cases) {
    expect(a.length >= 1 && a.length <= 30 && a.every(v => v >= -8 && v <= 8)).toBe(true);
    const cost = prefixCost(a);
    expect(repair(a)).toBe(cost);
    expect(prefixCost(a.map(v => v + 17))).toBe(cost);
    expect(prefixCost(a.map(v => v * 3))).toBe(cost * 3);
    expect(prefixCost([...a].sort((x, y) => x - y))).toBe(0);
    expect(prefixCost([...a, Math.max(...a)])).toBe(cost);
  }
});

it("checks full-size benchmarks against closed forms and exercises wide totals", () => {
  const benchmarks = draft.tests.filter(t => t.benchmark);
  expect(benchmarks).toHaveLength(3);
  expect(benchmarks.map(t => t.expected)).toEqual([0, 100000 * 99999 / 2, 50000 * 2000000]);
  expect(benchmarks[0].args).toEqual([Array(100000).fill(0)]);
  expect(benchmarks[1].args).toEqual([Array.from({ length: 100000 }, (_, i) => 100000 - i)]);
  expect(benchmarks[2].args).toEqual([Array.from({ length: 100000 }, (_, i) => i % 2 ? -1000000 : 1000000)]);
  expect(benchmarks[1].expected).toBeGreaterThan(2 ** 31);
  expect(benchmarks[2].expected).toBeGreaterThan(2 ** 31);
  for (const t of benchmarks) {
    const n = (t.args[0] as number[]).length;
    expect(n * (n + 1) / 2).toBe(5000050000);
  }
});
