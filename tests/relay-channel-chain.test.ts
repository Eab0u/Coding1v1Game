// @vitest-environment node
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { generateSmallCases, parseProblemDraft } from "../src/lib/problem-pipeline";

const raw = await readFile(new URL("../problems/drafts/relay-channel-chain.json", import.meta.url), "utf8");
const draft = parseProblemDraft(JSON.parse(raw));

// Trusted data-only oracles. Never execute authored Python on the host.
function sortedChain(values: number[]) {
  const labels = [...new Set(values)].sort((a, b) => a - b);
  let best = 0, run = 0;
  labels.forEach((label, i) => {
    run = i > 0 && label === labels[i - 1] + 1 ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}

function enumerateChains(values: number[]) {
  let best = 0;
  for (const start of values) {
    let length = 0;
    while (values.includes(start + length)) length++;
    best = Math.max(best, length);
  }
  return best;
}

it("parses the private draft and verifies every fixture against sorted adjacency", () => {
  expect(draft).toMatchObject({ slug: "relay-channel-chain", difficulty: "medium", functionName: "relay_channel_chain" });
  expect(draft.referenceSolution).not.toBe(draft.bruteForceSolution);
  expect(Buffer.byteLength(raw)).toBeLessThan(4_000_000);
  for (const fixture of [...draft.examples, ...draft.tests]) {
    const [values] = fixture.args as [number[]];
    expect(values.length).toBeLessThanOrEqual(100_000);
    expect(values.every(n => Number.isInteger(n) && Math.abs(n) <= 1_000_000)).toBe(true);
    expect(fixture.expected).toBe(sortedChain(values));
    if (!("benchmark" in fixture && fixture.benchmark)) expect(fixture.expected).toBe(enumerateChains(values));
  }
});

it("checks 2000 deterministic cases with independent enumeration and chain invariants", () => {
  const cases = generateSmallCases(draft) as [number[]][];
  expect(cases).toHaveLength(2000);
  expect(cases).toEqual(generateSmallCases(draft));
  expect(cases.some(([a]) => a.length === 0)).toBe(true);
  expect(cases.some(([a]) => a.includes(0) && a.some(n => n < 0))).toBe(true);
  expect(cases.some(([a]) => new Set(a).size < a.length)).toBe(true);
  for (const [values] of cases) {
    expect(values.length).toBeLessThanOrEqual(30);
    expect(values.every(n => n >= -12 && n <= 12)).toBe(true);
    const answer = enumerateChains(values);
    expect(sortedChain(values)).toBe(answer);
    expect(sortedChain([...values].reverse())).toBe(answer);
    expect(sortedChain([...values, ...values])).toBe(answer);
    expect(sortedChain(values.map(n => n + 100))).toBe(answer);
    expect(sortedChain(values.map(n => -n))).toBe(answer);
    expect(answer).toBeLessThanOrEqual(new Set(values).size);
  }
});

it("certifies full-size positive, negative and split-chain quadratic benchmarks", () => {
  const benchmarks = draft.tests.filter(t => t.benchmark);
  expect(benchmarks).toHaveLength(3);
  expect(benchmarks.map(t => t.expected)).toEqual([100000, 100000, 50000]);
  expect(benchmarks[0].args).toEqual([Array.from({ length: 100000 }, (_, i) => i)]);
  expect(benchmarks[1].args).toEqual([Array.from({ length: 100000 }, (_, i) => i === 0 ? 0 : -i)]);
  expect(benchmarks[2].args).toEqual([Array.from({ length: 100000 }, (_, i) => i < 50000 ? i : i + 1)]);
  for (const fixture of benchmarks) {
    const length = fixture.expected as number;
    const chains = 100000 / length;
    expect(chains * length * (length + 1) / 2).toBeGreaterThan(2_000_000_000);
  }
});
