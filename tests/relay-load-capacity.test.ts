// @vitest-environment node
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { generateSmallCases, parseProblemDraft } from "../src/lib/problem-pipeline";

const raw = await readFile(new URL("../problems/drafts/relay-load-capacity.json", import.meta.url), "utf8");
const draft = parseProblemDraft(JSON.parse(raw));

// Independent partition DP for fixture data; never execute authored Python here.
function partition(loads: number[], rounds: number) {
  let previous = [0, ...Array(loads.length).fill(Infinity)] as number[];
  for (let count = 1; count <= Math.min(rounds, loads.length); count++) {
    const next = [0, ...Array(loads.length).fill(Infinity)] as number[];
    for (let end = 1; end <= loads.length; end++) {
      let sum = 0;
      for (let start = end - 1; start >= 0; start--) {
        sum += loads[start];
        next[end] = Math.min(next[end], Math.max(previous[start], sum));
      }
    }
    previous = next;
  }
  return previous[loads.length];
}

function feasible(loads: number[], rounds: number, capacity: number) {
  let used = 1, sum = 0;
  for (const load of loads) {
    if (load > capacity) return false;
    if (sum + load > capacity) { used++; sum = 0; }
    sum += load;
  }
  return used <= rounds;
}

it("parses bounded original metadata and checks all small fixture answers", () => {
  expect(draft).toMatchObject({ slug: "relay-load-capacity", difficulty: "medium", topics: ["arrays", "binary search", "greedy"] });
  expect(draft.referenceSolution).not.toBe(draft.bruteForceSolution);
  expect(Buffer.byteLength(raw)).toBeLessThan(4_000_000);
  for (const t of [...draft.examples, ...draft.tests.filter(t => !t.benchmark)]) {
    expect(partition(t.args[0] as number[], t.args[1] as number)).toBe(t.expected);
  }
});

it("checks 2000 seeded cases with independent partitions, minimality and invariants", () => {
  const cases = generateSmallCases(draft) as [number[], number][];
  expect(cases).toHaveLength(2000);
  expect(cases).toEqual(generateSmallCases(draft));
  expect(cases.some(([a, rounds]) => rounds > a.length)).toBe(true);
  expect(cases.some(([, rounds]) => rounds === 1)).toBe(true);
  for (const [a, rounds] of cases) {
    expect(a.length >= 1 && a.length <= 18 && a.every(v => v >= 1 && v <= 12)).toBe(true);
    expect(rounds >= 1 && rounds <= 20).toBe(true);
    const result = partition(a, rounds);
    expect(feasible(a, rounds, result)).toBe(true);
    expect(feasible(a, rounds, result - 1)).toBe(false);
    expect(partition([...a].reverse(), rounds)).toBe(result);
    expect(partition(a.map(v => v * 3), rounds)).toBe(result * 3);
    expect(partition(a, rounds + 1)).toBeLessThanOrEqual(result);
    expect(partition(a, 1)).toBe(a.reduce((sum, v) => sum + v, 0));
    expect(partition(a, a.length)).toBe(Math.max(...a));
  }
});

it("checks full-size adversarial benchmarks and exact answers beyond 32 bits", () => {
  const benchmarks = draft.tests.filter(t => t.benchmark);
  expect(benchmarks.map(t => t.args)).toEqual([
    [Array(100000).fill(1000000), 1],
    [Array(100000).fill(1000000), 2],
    [Array.from({ length: 100000 }, (_, i) => i % 2 ? 1 : 999999), 1],
  ]);
  expect(benchmarks.map(t => t.expected)).toEqual([100000000000, 50000000000, 50000000000]);
  for (const t of benchmarks) {
    expect(feasible(t.args[0] as number[], t.args[1] as number, t.expected as number)).toBe(true);
    expect(feasible(t.args[0] as number[], t.args[1] as number, (t.expected as number) - 1)).toBe(false);
  }
});
