// @vitest-environment node
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { generateSmallCases, parseProblemDraft } from "../src/lib/problem-pipeline";

const raw = await readFile(new URL("../problems/drafts/relay-target-bursts.json", import.meta.url), "utf8");
const draft = parseProblemDraft(JSON.parse(raw));

// Trusted data-only oracles; authored Python runs only in the isolated sandbox.
function enumerate(values: number[], target: number) {
  let count = 0;
  for (let start = 0; start < values.length; start++) {
    for (let end = start + 1; end <= values.length; end++) {
      if (values.slice(start, end).reduce((sum, n) => sum + n, 0) === target) count++;
    }
  }
  return count;
}

function prefixPairs(values: number[], target: number) {
  const positions = new Map<number, number[]>();
  let prefix = 0;
  for (let i = 0; i <= values.length; i++) {
    if (i) prefix += values[i - 1];
    positions.set(prefix, [...(positions.get(prefix) ?? []), i]);
  }
  let count = 0;
  for (const [sum, starts] of positions) {
    const ends = positions.get(sum + target) ?? [];
    let first = 0;
    for (const start of starts) {
      while (first < ends.length && ends[first] <= start) first++;
      count += ends.length - first;
    }
  }
  return count;
}

it("parses the draft and verifies authored small answers and constraints independently", () => {
  expect(draft).toMatchObject({ slug: "relay-target-bursts", difficulty: "medium", functionName: "relay_target_bursts" });
  expect(draft.referenceSolution).not.toBe(draft.bruteForceSolution);
  expect(Buffer.byteLength(raw)).toBeLessThan(4_000_000);
  for (const fixture of [...draft.examples, ...draft.tests.filter(t => !t.benchmark)]) {
    const [values, target] = fixture.args as [number[], number];
    expect(enumerate(values, target)).toBe(fixture.expected);
    expect(prefixPairs(values, target)).toBe(fixture.expected);
  }
  for (const fixture of [...draft.examples, ...draft.tests]) {
    const [values, target] = fixture.args as [number[], number];
    expect(values.length).toBeLessThanOrEqual(100000);
    expect([...values, target].every(n => Number.isInteger(n) && Math.abs(n) <= 1000000)).toBe(true);
  }
});

it("checks 2000 seeded cases against enumeration, reversal and sign symmetry", () => {
  const cases = generateSmallCases(draft) as [number[], number][];
  expect(cases).toHaveLength(2000);
  expect(cases).toEqual(generateSmallCases(draft));
  expect(cases.some(([a]) => a.length === 0)).toBe(true);
  expect(cases.some(([a, t]) => t === 0 && a.includes(0))).toBe(true);
  expect(cases.some(([a, t]) => t < 0 && a.some(n => n < 0))).toBe(true);
  for (const [values, target] of cases) {
    const answer = enumerate(values, target);
    expect(prefixPairs(values, target)).toBe(answer);
    expect(prefixPairs([...values].reverse(), target)).toBe(answer);
    expect(prefixPairs(values.map(n => -n), -target)).toBe(answer);
    expect(answer).toBeLessThanOrEqual(values.length * (values.length + 1) / 2);
  }
});

it("certifies three full-size quadratic benchmarks with closed-form answers", () => {
  const benchmarks = draft.tests.filter(t => t.benchmark);
  expect(benchmarks).toHaveLength(3);
  const n = 100000;
  expect(benchmarks[0]).toMatchObject({ args: [Array(n).fill(0), 0], expected: n * (n + 1) / 2 });
  expect(benchmarks[1]).toMatchObject({ args: [Array(n).fill(1), n / 2], expected: n / 2 + 1 });
  // Equal prefix sums occur 50001 times at even boundaries, 50000 at odd ones.
  const pairs = (count: number) => count * (count - 1) / 2;
  expect(benchmarks[2]).toMatchObject({ args: [Array.from({ length: n }, (_, i) => i % 2 === 0 ? 1 : -1), 0], expected: pairs(50001) + pairs(50000) });
  expect(n * (n + 1) / 2).toBeGreaterThan(1_000_000_000);
  expect(benchmarks[0].expected).toBeGreaterThan(2 ** 31 - 1);
});
