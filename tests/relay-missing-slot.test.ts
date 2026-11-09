// @vitest-environment node
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { generateSmallCases, parseProblemDraft } from "../src/lib/problem-pipeline";

const raw = await readFile(new URL("../problems/drafts/relay-missing-slot.json", import.meta.url), "utf8");
const draft = parseProblemDraft(JSON.parse(raw));

// Trusted data-only oracles; authored Python executes only in the sandbox.
function sortedGap(values: number[]) {
  let missing = 1;
  for (const value of [...values].sort((a, b) => a - b)) {
    if (value === missing) missing++;
    else if (value > missing) break;
  }
  return missing;
}

function scanGap(values: number[]) {
  for (let candidate = 1; candidate <= values.length + 1; candidate++) {
    if (!values.includes(candidate)) return candidate;
  }
  throw new Error("Pigeonhole bound violated");
}

it("parses the private draft and independently checks all authored answers", () => {
  expect(draft).toMatchObject({ slug: "relay-missing-slot", difficulty: "easy", functionName: "relay_missing_slot" });
  expect(draft.referenceSolution).not.toBe(draft.bruteForceSolution);
  expect(Buffer.byteLength(raw)).toBeLessThan(4_000_000);
  for (const fixture of [...draft.examples, ...draft.tests]) {
    const [values] = fixture.args as [number[]];
    expect(values.length).toBeLessThanOrEqual(100_000);
    expect(values.every(n => Number.isInteger(n) && Math.abs(n) <= 1_000_000)).toBe(true);
    expect(fixture.expected).toBe(sortedGap(values));
    if (!('benchmark' in fixture && fixture.benchmark)) expect(fixture.expected).toBe(scanGap(values));
  }
});

it("generates 2000 deterministic small cases including empty logs, duplicates and diagnostics", () => {
  const cases = generateSmallCases(draft) as [number[]][];
  expect(cases).toHaveLength(2000);
  expect(cases).toEqual(generateSmallCases(draft));
  expect(cases.some(([a]) => a.length === 0)).toBe(true);
  expect(cases.some(([a]) => a.includes(0) && a.some(n => n < 0))).toBe(true);
  expect(cases.some(([a]) => new Set(a).size < a.length)).toBe(true);
  for (const [values] of cases) {
    expect(values.length).toBeLessThanOrEqual(30);
    expect(values.every(n => n >= -5 && n <= 15)).toBe(true);
    const answer = scanGap(values);
    expect(sortedGap(values)).toBe(answer);
    expect(sortedGap([...values].reverse())).toBe(answer);
    expect(sortedGap([...values, ...values, 0, -1])).toBe(answer);
    expect(sortedGap([...values, answer])).toBeGreaterThan(answer);
    expect(answer).toBeLessThanOrEqual(values.length + 1);
  }
});

it("includes full-size quadratic scans in both orders and with diagnostic padding", () => {
  const benchmarks = draft.tests.filter(t => t.benchmark);
  expect(benchmarks).toHaveLength(3);
  expect(benchmarks.map(t => t.expected)).toEqual([100001, 100001, 50001]);
  expect(benchmarks[0].args).toEqual([Array.from({ length: 100000 }, (_, i) => i + 1)]);
  expect(benchmarks[1].args).toEqual([Array.from({ length: 100000 }, (_, i) => 100000 - i)]);
  expect(benchmarks[2].args).toEqual([Array.from({ length: 100000 }, (_, i) => i < 50000 ? i + 1 : 0)]);
  for (const fixture of benchmarks) {
    const presentPrefix = (fixture.expected as number) - 1;
    // Each occupied candidate is found at a different position in the prefix.
    expect(presentPrefix * (presentPrefix + 1) / 2).toBeGreaterThan(1_000_000_000);
  }
});
