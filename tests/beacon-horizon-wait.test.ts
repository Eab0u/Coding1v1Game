// @vitest-environment node
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { generateSmallCases, parseProblemDraft } from "../src/lib/problem-pipeline";

const raw = await readFile(new URL("../problems/drafts/beacon-horizon-wait.json", import.meta.url), "utf8");
const draft = parseProblemDraft(JSON.parse(raw));

// Trusted data-only oracles; neither authored Python solution executes here.
function enumerate(a: number[]) {
  return a.reduce((total, height, i) => {
    const offset = a.slice(i + 1).findIndex(value => value > height);
    return total + (offset < 0 ? 0 : offset + 1);
  }, 0);
}

// Reverse traversal skips ranges already known to have no taller beacon.
function jumpOracle(a: number[]) {
  const next = Array<number>(a.length).fill(a.length);
  let total = 0;
  for (let i = a.length - 1; i >= 0; i--) {
    let j = i + 1;
    while (j < a.length && a[j] <= a[i]) j = next[j];
    next[i] = j;
    if (j < a.length) total += j - i;
  }
  return total;
}

it("parses the private medium draft and independently checks every small fixture", () => {
  expect(draft).toMatchObject({ slug: "beacon-horizon-wait", difficulty: "medium", topics: ["arrays", "monotonic stack"] });
  expect(Buffer.byteLength(raw)).toBeLessThan(4_000_000);
  expect(draft.referenceSolution).not.toBe(draft.bruteForceSolution);
  for (const fixture of [...draft.examples, ...draft.tests.filter(t => !t.benchmark)]) {
    expect(fixture.expected, JSON.stringify(fixture.args)).toBe(enumerate(fixture.args[0] as number[]));
  }
});

it("compares 2000 reproducible small cases and preserves waits under increasing height transforms", () => {
  const cases = generateSmallCases(draft) as [number[]][];
  expect(cases).toHaveLength(2000);
  expect(cases).toEqual(generateSmallCases(draft));
  expect(cases.some(([a]) => new Set(a).size < a.length)).toBe(true);
  expect(cases.some(([a]) => a.length === 1)).toBe(true);
  for (const [a] of cases) {
    expect(a.length).toBeGreaterThanOrEqual(1);
    expect(a.length).toBeLessThanOrEqual(24);
    expect(a.every(n => Number.isInteger(n) && n >= 0 && n <= 8)).toBe(true);
    const answer = enumerate(a);
    expect(jumpOracle(a)).toBe(answer);
    expect(jumpOracle(a.map(n => n * 3 + 7))).toBe(answer);
  }
});

it("checks full-size adversarial benchmarks and answers exceeding 32-bit range", () => {
  const benchmarks = draft.tests.filter(t => t.benchmark);
  expect(benchmarks).toHaveLength(3);
  expect(benchmarks[0].args).toEqual([Array(100_000).fill(5)]);
  expect(benchmarks[1].args).toEqual([Array.from({ length: 100_000 }, (_, i) => 100_000 - i)]);
  expect(benchmarks[2].args).toEqual([[...Array(99_999).fill(0), 1_000_000]]);
  for (const fixture of benchmarks) {
    const a = fixture.args[0] as number[];
    expect(jumpOracle(a)).toBe(fixture.expected);
    expect(a.length * (a.length - 1) / 2).toBe(4_999_950_000);
  }
  expect(benchmarks[2].expected).toBeGreaterThan(2 ** 31);
});
