// @vitest-environment node
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { generateSmallCases, parseProblemDraft } from "../src/lib/problem-pipeline";

const raw = await readFile(new URL("../problems/drafts/relay-balanced-cuts.json", import.meta.url), "utf8");
const draft = parseProblemDraft(JSON.parse(raw));

// Trusted data-only oracles; neither draft Python solution executes on the host.
function enumerate(a: number[]) {
  let count = 0;
  for (let cut = 1; cut < a.length; cut++) {
    if (a.slice(0, cut).reduce((s, v) => s + v, 0) ===
        a.slice(cut).reduce((s, v) => s + v, 0)) count++;
  }
  return count;
}

// Independent signed-balance walk: moving an entry across a cut changes balance by twice its value.
function balanceWalk(a: number[]) {
  let balance = -a.reduce((s, v) => s + v, 0);
  return a.slice(0, -1).filter(v => { balance += 2 * v; return balance === 0; }).length;
}

it("parses the easy draft and verifies authored examples and edge fixtures", () => {
  expect(draft).toMatchObject({ slug: "relay-balanced-cuts", difficulty: "easy" });
  expect(draft.referenceSolution).not.toBe(draft.bruteForceSolution);
  expect(Buffer.byteLength(raw)).toBeLessThan(4_000_000);
  for (const fixture of [...draft.examples, ...draft.tests.filter(t => !t.benchmark)]) {
    expect(fixture.expected).toBe(enumerate(fixture.args[0] as number[]));
  }
});

it("compares 2000 deterministic signed cases and reversal and scaling invariants", () => {
  const cases = generateSmallCases(draft) as [number[]][];
  expect(cases).toHaveLength(2000);
  expect(cases).toEqual(generateSmallCases(draft));
  expect(cases.some(([a]) => a.length === 1)).toBe(true);
  expect(cases.some(([a]) => a.includes(0))).toBe(true);
  expect(cases.some(([a]) => a.some(v => v < 0) && a.some(v => v > 0))).toBe(true);
  for (const [a] of cases) {
    expect(a.length).toBeGreaterThanOrEqual(1);
    expect(a.length).toBeLessThanOrEqual(30);
    expect(a.every(v => v >= -8 && v <= 8)).toBe(true);
    const expected = enumerate(a);
    expect(balanceWalk(a)).toBe(expected);
    expect(enumerate([...a].reverse())).toBe(expected);
    expect(enumerate(a.map(v => -3 * v))).toBe(expected);
  }
});

it("checks full-size benchmark formulas and quadratic baseline work", () => {
  const benchmarks = draft.tests.filter(t => t.benchmark);
  expect(benchmarks).toHaveLength(3);
  expect(benchmarks[0].args).toEqual([Array(100_000).fill(0)]);
  expect(benchmarks[1].args).toEqual([Array(100_000).fill(1_000_000)]);
  expect(benchmarks[2].args).toEqual([Array.from({ length: 100_000 }, (_, i) => i % 2 ? -1_000_000 : 1_000_000)]);
  expect(benchmarks.map(t => t.expected)).toEqual([99_999, 1, 49_999]);
  for (const t of benchmarks) {
    const a = t.args[0] as number[];
    expect(balanceWalk(a)).toBe(t.expected);
    expect(a.length * (a.length - 1)).toBe(9_999_900_000);
  }
  expect((benchmarks[1].args[0] as number[]).reduce((s, v) => s + v, 0)).toBeGreaterThan(2 ** 31);
});
