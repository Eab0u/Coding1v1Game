// @vitest-environment node
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { generateSmallCases, parseProblemDraft } from "../src/lib/problem-pipeline";

const raw = await readFile(new URL("../problems/drafts/relay-order-conflicts.json", import.meta.url), "utf8");
const draft = parseProblemDraft(JSON.parse(raw));

// Data-only pair enumeration; authored Python runs exclusively in the sandbox.
function enumerate(a: number[]) {
  let total = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = i + 1; j < a.length; j++) if (a[i] > a[j]) total++;
  }
  return total;
}

// Independent insertion-rank accounting, rather than the Python merge approach.
function ranks(a: number[]) {
  const sorted: number[] = [];
  let total = 0;
  for (const value of a) {
    let index = 0;
    while (index < sorted.length && sorted[index] <= value) index++;
    total += sorted.length - index;
    sorted.splice(index, 0, value);
  }
  return total;
}

it("parses the draft and checks strict comparisons, duplicates and signed fixtures", () => {
  expect(draft).toMatchObject({ slug: "relay-order-conflicts", difficulty: "medium" });
  expect(draft.referenceSolution).not.toBe(draft.bruteForceSolution);
  expect(Buffer.byteLength(raw)).toBeLessThan(4_000_000);
  for (const t of [...draft.examples, ...draft.tests.filter(t => !t.benchmark)]) {
    expect(enumerate(t.args[0] as number[])).toBe(t.expected);
  }
});

it("checks 2000 deterministic cases against ranks and order invariants", () => {
  const cases = generateSmallCases(draft) as [number[]][];
  expect(cases).toHaveLength(2000);
  expect(cases).toEqual(generateSmallCases(draft));
  expect(cases.some(([a]) => a.length === 1)).toBe(true);
  expect(cases.some(([a]) => a.includes(0) && a.some(v => v < 0))).toBe(true);
  for (const [a] of cases) {
    expect(a.length >= 1 && a.length <= 30 && a.every(v => v >= -8 && v <= 8)).toBe(true);
    const count = enumerate(a);
    expect(ranks(a)).toBe(count);
    expect(ranks(a.map(v => v * 3 + 11))).toBe(count);
    expect(ranks([...a, 9])).toBe(count);
    expect(ranks([-9, ...a])).toBe(count);
    let unequal = 0;
    for (let i = 0; i < a.length; i++) {
      for (let j = i + 1; j < a.length; j++) if (a[i] !== a[j]) unequal++;
    }
    expect(ranks([...a].reverse()) + count).toBe(unequal);
    expect(ranks(a.map(v => -v)) + count).toBe(unequal);
  }
});

it("checks full-size benchmark shapes and closed-form answers beyond 32-bit range", () => {
  const benchmarks = draft.tests.filter(t => t.benchmark);
  expect(benchmarks).toHaveLength(3);
  expect(benchmarks.map(t => t.args)).toEqual([
    [Array.from({ length: 100000 }, (_, i) => 100000 - i)],
    [Array.from({ length: 100000 }, (_, i) => i)],
    [Array(100000).fill(-7)],
  ]);
  expect(benchmarks.map(t => t.expected)).toEqual([100000 * 99999 / 2, 0, 0]);
});
