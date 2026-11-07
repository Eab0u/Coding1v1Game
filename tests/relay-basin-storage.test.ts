// @vitest-environment node
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { generateSmallCases, parseProblemDraft } from "../src/lib/problem-pipeline";

const raw = await readFile(new URL("../problems/drafts/relay-basin-storage.json", import.meta.url), "utf8");
const draft = parseProblemDraft(JSON.parse(raw));

// Trusted data-only oracles; authored Python executes only in the sandbox.
function prefixStorage(a: number[]) {
  const prefix: number[] = [];
  a.forEach((h, i) => { prefix[i] = Math.max(h, prefix[i - 1] ?? 0); });
  let right = 0, total = 0;
  for (let i = a.length - 1; i >= 0; i--) {
    right = Math.max(right, a[i]);
    total += Math.min(prefix[i], right) - a[i];
  }
  return total;
}

function horizontalStorage(a: number[]) {
  let total = 0;
  for (let level = 1; level <= Math.max(0, ...a); level++) {
    const left = a.findIndex(h => h >= level);
    const right = a.findLastIndex(h => h >= level);
    for (let i = left + 1; i < right; i++) if (a[i] < level) total++;
  }
  return total;
}

it("parses the draft and verifies all fixtures using independent prefix and suffix maxima", () => {
  expect(draft).toMatchObject({ slug: "relay-basin-storage", difficulty: "medium", functionName: "relay_basin_storage" });
  expect(draft.referenceSolution).not.toBe(draft.bruteForceSolution);
  expect(Buffer.byteLength(raw)).toBeLessThan(4_000_000);
  for (const t of [...draft.examples, ...draft.tests]) {
    const [a] = t.args as [number[]];
    expect(a.length).toBeLessThanOrEqual(100000);
    expect(a.every(h => Number.isInteger(h) && h >= 0 && h <= 1000000)).toBe(true);
    expect(prefixStorage(a)).toBe(t.expected);
  }
});

it("compares 2000 seeded trays with horizontal layer enumeration and invariants", () => {
  const cases = generateSmallCases(draft) as [number[]][];
  expect(cases).toHaveLength(2000);
  expect(cases).toEqual(generateSmallCases(draft));
  expect(cases.some(([a]) => a.length === 0)).toBe(true);
  expect(cases.some(([a]) => horizontalStorage(a) > 0)).toBe(true);
  for (const [a] of cases) {
    expect(a.length).toBeLessThanOrEqual(30);
    expect(a.every(h => h >= 0 && h <= 12)).toBe(true);
    const total = horizontalStorage(a);
    expect(prefixStorage(a)).toBe(total);
    expect(prefixStorage([...a].reverse())).toBe(total);
    expect(prefixStorage(a.map(h => h + 7))).toBe(total);
    expect(prefixStorage(a.map(h => h * 3))).toBe(total * 3);
    expect(prefixStorage([0, ...a, 0])).toBe(total);
  }
});

it("certifies full-size deep, alternating and draining trays and quadratic baseline work", () => {
  const large = draft.tests.filter(t => t.benchmark);
  expect(large).toHaveLength(3);
  expect(large[0].args).toEqual([Array.from({ length: 100000 }, (_, i) => i === 0 || i === 99999 ? 1000000 : 0)]);
  expect(large[1].args).toEqual([Array.from({ length: 100000 }, (_, i) => i % 2 === 0 ? 1000000 : 0)]);
  expect(large[2].args).toEqual([Array.from({ length: 100000 }, (_, i) => i)]);
  expect(large.map(t => t.expected)).toEqual([99998 * 1000000, 49999 * 1000000, 0]);
  expect(large[0].expected as number).toBeGreaterThan(2 ** 31);
  for (const t of large) {
    const n = (t.args[0] as number[]).length;
    expect(n * (n + 1)).toBeGreaterThan(10_000_000_000);
  }
});
