// @vitest-environment node
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { generateSmallCases, parseProblemDraft } from "../src/lib/problem-pipeline";

const raw = await readFile(new URL("../problems/drafts/relay-cycle-intervals.json", import.meta.url), "utf8");
const draft = parseProblemDraft(JSON.parse(raw));

// Trusted data oracles only. Never execute draft Python on the host.
function enumerate(a: number[], k: number) {
  let count = 0;
  for (let i = 0; i < a.length; i++) {
    let sum = 0;
    for (let j = i; j < a.length; j++) {
      sum += a[j];
      if (sum % k === 0) count++;
    }
  }
  return count;
}

// Independent offline identity: equal prefix residues form unordered pairs.
function residuePairs(a: number[], k: number) {
  let sum = 0;
  const residues = [0, ...a.map(value => {
    sum += value;
    return ((sum % k) + k) % k;
  })].sort((x, y) => x - y);
  let answer = 0;
  for (let i = 0; i < residues.length;) {
    let end = i + 1;
    while (end < residues.length && residues[end] === residues[i]) end++;
    answer += (end - i) * (end - i - 1) / 2;
    i = end;
  }
  return answer;
}

it("parses a bounded original medium draft and verifies every authored small answer", () => {
  expect(draft).toMatchObject({ slug: "relay-cycle-intervals", difficulty: "medium" });
  expect(Buffer.byteLength(raw)).toBeLessThan(4_000_000);
  expect(draft.referenceSolution).not.toBe(draft.bruteForceSolution);
  for (const fixture of [...draft.examples, ...draft.tests.filter(t => !t.benchmark)]) {
    const [a, k] = fixture.args as [number[], number];
    expect(fixture.expected).toBe(enumerate(a, k));
    expect(fixture.expected).toBe(residuePairs(a, k));
  }
});

it("covers seeded signed inputs, zeroes and unit cycles with independent identities", () => {
  const cases = generateSmallCases(draft) as [number[], number][];
  expect(cases).toHaveLength(2000);
  expect(cases).toEqual(generateSmallCases(draft));
  expect(cases.some(([a]) => a.includes(0))).toBe(true);
  expect(cases.some(([a]) => a.some(x => x < 0) && a.some(x => x > 0))).toBe(true);
  expect(cases.some(([, k]) => k === 1)).toBe(true);
  for (const [a, k] of cases) {
    expect(a.length).toBeGreaterThanOrEqual(1);
    expect(a.length).toBeLessThanOrEqual(30);
    expect(a.every(x => x >= -12 && x <= 12)).toBe(true);
    expect(k >= 1 && k <= 12).toBe(true);
    const expected = enumerate(a, k);
    expect(residuePairs(a, k)).toBe(expected);
    expect(enumerate([...a].reverse(), k)).toBe(expected);
    expect(enumerate(a.map(x => -x), k)).toBe(expected);
    expect(enumerate(a.map(x => x + k), k)).toBe(expected);
  }
});

it("checks full-size benchmark structure, formulas and quadratic baseline work", () => {
  const benchmarks = draft.tests.filter(t => t.benchmark);
  expect(benchmarks).toHaveLength(3);
  expect(benchmarks.map(t => t.args)).toEqual([
    [Array(100000).fill(0), 1000000],
    [Array(100000).fill(1), 1000000],
    [Array.from({ length: 100000 }, (_, i) => i % 2 ? -1000000 : 1000000), 1000000],
  ]);
  expect(benchmarks.map(t => t.expected)).toEqual([5000050000, 0, 5000050000]);
  for (const fixture of benchmarks) {
    const [a, k] = fixture.args as [number[], number];
    expect(residuePairs(a, k)).toBe(fixture.expected);
    expect(a.length * (a.length + 1) / 2).toBeGreaterThan(5_000_000_000);
  }
});
