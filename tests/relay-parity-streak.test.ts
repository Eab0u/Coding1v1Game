// @vitest-environment node
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { generateSmallCases, parseProblemDraft } from "../src/lib/problem-pipeline";

const raw = await readFile(new URL("../problems/drafts/relay-parity-streak.json", import.meta.url), "utf8");
const draft = parseProblemDraft(JSON.parse(raw));
const parity = (v: number) => Math.abs(v % 2);

// Data-only enumeration: no authored Python is executed on the host.
function enumerate(a: number[]) {
  let best = 1;
  for (let start = 0; start < a.length; start++) {
    for (let end = start + best; end < a.length; end++) {
      const part = a.slice(start, end + 1);
      if (part.every((v, i) => i === 0 || parity(v) !== parity(part[i - 1]))) best = part.length;
    }
  }
  return best;
}

// Independently partition at same-parity boundaries and measure gap lengths.
function partition(a: number[]) {
  const boundaries = [0];
  for (let i = 1; i < a.length; i++) {
    if (parity(a[i]) === parity(a[i - 1])) boundaries.push(i);
  }
  boundaries.push(a.length);
  let best = 0;
  for (let i = 1; i < boundaries.length; i++) best = Math.max(best, boundaries[i] - boundaries[i - 1]);
  return best;
}

it("parses the original draft and checks examples and signed edge fixtures", () => {
  expect(draft).toMatchObject({ slug: "relay-parity-streak", difficulty: "easy" });
  expect(draft.referenceSolution).not.toBe(draft.bruteForceSolution);
  expect(Buffer.byteLength(raw)).toBeLessThan(4_000_000);
  for (const t of [...draft.examples, ...draft.tests.filter(t => !t.benchmark)]) {
    expect(enumerate(t.args[0] as number[])).toBe(t.expected);
  }
});

it("compares 2000 seeded cases with independent partitions and parity-preserving invariants", () => {
  const cases = generateSmallCases(draft) as [number[]][];
  expect(cases).toHaveLength(2000);
  expect(cases).toEqual(generateSmallCases(draft));
  expect(cases.some(([a]) => a.length === 1)).toBe(true);
  expect(cases.some(([a]) => a.includes(0) && a.some(v => v < 0))).toBe(true);
  for (const [a] of cases) {
    expect(a.length >= 1 && a.length <= 30 && a.every(v => v >= -8 && v <= 8)).toBe(true);
    const best = enumerate(a);
    expect(partition(a)).toBe(best);
    expect(partition([...a].reverse())).toBe(best);
    expect(partition(a.map(v => -v))).toBe(best);
    expect(partition(a.map(v => v + 1))).toBe(best);
    expect(partition(a.map(v => v * 3))).toBe(best);
    expect(partition(a.map(v => v * 2))).toBe(1);
    expect(partition([...a, a[a.length - 1]])).toBe(best);
  }
});

it("checks full-size alternating benchmarks and a central break against closed forms", () => {
  const tests = draft.tests.filter(t => t.benchmark);
  expect(tests).toHaveLength(3);
  expect(tests.map(t => t.expected)).toEqual([100000, 100000, 50000]);
  expect(tests.map(t => t.args)).toEqual([
    [Array.from({ length: 100000 }, (_, i) => i % 2)],
    [Array.from({ length: 100000 }, (_, i) => i - 50000)],
    [Array.from({ length: 100000 }, (_, i) => i === 50000 ? 1 : i % 2)],
  ]);
  for (const t of tests) expect(partition(t.args[0] as number[])).toBe(t.expected);
});
