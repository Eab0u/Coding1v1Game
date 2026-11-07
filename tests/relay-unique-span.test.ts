// @vitest-environment node
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { generateSmallCases, parseProblemDraft } from "../src/lib/problem-pipeline";

const raw = await readFile(new URL("../problems/drafts/relay-unique-span.json", import.meta.url), "utf8");
const draft = parseProblemDraft(JSON.parse(raw));

// Trusted data-only oracle: shrink a queue until the new channel is absent.
function queueSpan(values: number[]) {
  const window: number[] = [];
  let best = 0;
  for (const value of values) {
    while (window.includes(value)) window.shift();
    window.push(value);
    best = Math.max(best, window.length);
  }
  return best;
}

function enumerateSpans(values: number[]) {
  let best = 0;
  for (let start = 0; start < values.length; start++) {
    for (let end = start + 1; end <= values.length; end++) {
      const span = values.slice(start, end);
      if (new Set(span).size === span.length) best = Math.max(best, span.length);
    }
  }
  return best;
}

it("validates the private draft contract and all small authored answers", () => {
  expect(draft).toMatchObject({ slug: "relay-unique-span", difficulty: "medium", functionName: "relay_unique_span" });
  expect(draft.referenceSolution).not.toBe(draft.bruteForceSolution);
  expect(Buffer.byteLength(raw)).toBeLessThan(4_000_000);
  for (const fixture of [...draft.examples, ...draft.tests.filter(t => !t.benchmark)]) {
    const [values] = fixture.args as [number[]];
    expect(fixture.expected).toBe(enumerateSpans(values));
    expect(fixture.expected).toBe(queueSpan(values));
  }
});

it("checks 2000 seeded cases against independent enumeration and metamorphic properties", () => {
  const cases = generateSmallCases(draft) as [number[]][];
  expect(cases).toHaveLength(2000);
  expect(cases).toEqual(generateSmallCases(draft));
  expect(cases.some(([a]) => a.length === 0)).toBe(true);
  expect(cases.some(([a]) => a.includes(0) && a.some(n => n < 0))).toBe(true);
  for (const [values] of cases) {
    const answer = enumerateSpans(values);
    expect(queueSpan(values)).toBe(answer);
    expect(queueSpan([...values].reverse())).toBe(answer);
    expect(queueSpan(values.map(n => n * 7 + 100))).toBe(answer);
    expect(queueSpan([...values, 100])).toBeGreaterThanOrEqual(answer);
    expect(answer).toBeLessThanOrEqual(new Set(values).size);
  }
});

it("checks full-size benchmark answers and quadratic baseline work without running Python", () => {
  const benchmarks = draft.tests.filter(t => t.benchmark);
  expect(benchmarks).toHaveLength(3);
  expect(benchmarks.map(t => t.expected)).toEqual([100000, 100000, 50000]);
  for (const fixture of benchmarks) {
    const [values] = fixture.args as [number[]];
    expect(values).toHaveLength(100000);
    expect(values.every(n => Number.isInteger(n) && Math.abs(n) <= 1000000)).toBe(true);
    const distinct = new Set(values).size;
    expect(fixture.expected).toBe(distinct);
    // The first distinct-length entries certify the upper bound is attainable.
    expect(new Set(values.slice(0, distinct)).size).toBe(distinct);
    expect(distinct * (distinct + 1) / 2).toBeGreaterThan(1_000_000_000);
  }
});
