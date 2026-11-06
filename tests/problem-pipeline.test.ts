// @vitest-environment node
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import type { Pool } from "pg";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { generateSmallCases, validateAndPublish, type ProblemDraft, type ValidationRunner } from "../src/lib/problem-pipeline";
import type { JudgeRequest } from "../src/lib/judge";

const draft: ProblemDraft = {
  slug: "pair-gap", title: "Pair gap", statement: "Find the smallest absolute gap between two entries. Example: [3, 8, 4] gives 1.",
  functionName: "pair_gap", functionSignature: "def pair_gap(nums: list[int]) -> int:",
  difficulty: "easy", topics: ["sorting"], constraints: "2 <= len(nums) <= 100000; -1000000 <= nums[i] <= 1000000",
  examples: [{ args: [[3, 8, 4]], expected: 1, explanation: "3 and 4 differ by one." }],
  referenceSolution: "def pair_gap(nums):\n a = sorted(nums)\n return min(b-a for a,b in zip(a,a[1:]))",
  bruteForceSolution: "def pair_gap(nums):\n return min(abs(a-b) for i,a in enumerate(nums) for b in nums[i+1:])",
  generator: { seed: 42, args: [{ kind: "integer-array", min: -10, max: 10, minLength: 2, maxLength: 20 }] },
  tests: [{ args: [[1, 1]], expected: 0 }, { args: [[1, 5, 9]], expected: 4, benchmark: true }],
  cpuLimitMs: 1000, memoryLimitKb: 65536,
};
// This tiny benchmark is deliberately a mock fixture, never a publishable real problem.
const success: ValidationRunner = async request => ({
  score: { testsPassed: request.source === draft.bruteForceSolution && request.tests.length === 1 && request.tests[0].benchmark ? 0 : request.tests.length,
    testsTotal: request.tests.length, largestTestsCpuMs: [1000, 1000, 1000], submittedAtMs: 0 },
  timeouts: request.source === draft.bruteForceSolution && request.tests.length === 1 && request.tests[0].benchmark ? 3 : 0,
});
const db = new PGlite();
beforeAll(async () => { await db.exec(await readFile(new URL("../db/migrations/001_initial.sql", import.meta.url), "utf8")); }, 30000);
afterAll(async () => { await db.close(); });

it("generates 2000 reproducible bounded cases with seed-sensitive variation and no draft mutation", () => {
  const before = structuredClone(draft);
  const cases = generateSmallCases(draft);
  expect(cases).toHaveLength(2000);
  expect(cases).toEqual(generateSmallCases(draft));
  expect(new Set(cases.map(c => JSON.stringify(c))).size).toBeGreaterThan(1500);
  expect(cases.every(c => Array.isArray(c[0]) && c[0].length >= 2 && c[0].length <= 20 && c[0].every(n => typeof n === "number" && n >= -10 && n <= 10))).toBe(true);
  expect(cases).not.toEqual(generateSmallCases({ ...draft, generator: { ...draft.generator, seed: 43 } }));
  expect(draft).toEqual(before);
  expect(() => generateSmallCases(draft, 100)).toThrow();
  const ints = { ...draft, generator: { seed: 0, args: [{ kind: "integer" as const, min: -2, max: 2 }] } };
  expect(new Set(generateSmallCases(ints).map(c => c[0]))).toEqual(new Set([-2, -1, 0, 1, 2]));
});

it.each([
  { slug: "../bad" }, { functionName: "solve;exit()" }, { functionSignature: "def wrong():" },
  { tests: [{ args: [[1]], expected: 0 }] }, { examples: [] }, { topics: [] }, { cpuLimitMs: 0 },
  { memoryLimitKb: Infinity }, { generator: { seed: -1, args: [] } },
  { generator: { seed: 1, args: [{ kind: "python", min: 0, max: 10 }] } },
  { generator: { seed: 1, args: [{ kind: "integer-array", min: 0, max: 10, minLength: 0, maxLength: 51 }] } },
  { tests: [{ args: [], expected: 0 }, { args: [[1]], expected: NaN, benchmark: true }] },
])("rejects malformed drafts before sandbox execution: %j", async change => {
  const run = vi.fn(success);
  await expect(validateAndPublish({ ...draft, ...change }, run)).rejects.toThrow("Invalid problem");
  expect(run).not.toHaveBeenCalled();
});

it("validates without publishing and sends independent comparisons, examples and benchmarks to the runner", async () => {
  const run = vi.fn(success);
  const result = await validateAndPublish(draft, run);
  expect(result).toMatchObject({ randomCases: 2000, hiddenTests: 3, published: false });
  expect(result.sha256).toMatch(/^[0-9a-f]{64}$/);
  const requests = run.mock.calls.map(c => c[0]);
  expect(requests).toHaveLength(23);
  expect(requests.slice(0, 20).every(r => r.functionName === "validate_cases" && (r.tests[0].args[0] as unknown[]).length === 100)).toBe(true);
  expect(requests[0].source).toContain("json.loads(json.dumps(args))");
  expect(requests[20].tests).toEqual([{ args: [[3, 8, 4]], expected: 1 }, ...draft.tests]);
  expect(requests[21].tests).toEqual([{ args: [[3, 8, 4]], expected: 1, benchmark: true }, { ...draft.tests[0], benchmark: false }]);
  expect(requests[22].tests).toEqual([draft.tests[1]]);
});

it.each([0, 20, 21, 22])("never writes if validation stage %i fails", async stage => {
  let calls = 0;
  const pool = { query: vi.fn() };
  const run: ValidationRunner = async request => {
    const result = await success(request);
    if (calls++ === stage) return { ...result, timeouts: 0, score: { ...result.score, testsPassed: 0 } };
    return result;
  };
  await expect(validateAndPublish(draft, run, pool as unknown as Pool)).rejects.toThrow();
  expect(pool.query).not.toHaveBeenCalled();
});

it.each([0, 1, 2])("rejects crashes, wrong answers and partial timeout counts (%i)", async timeouts => {
  const run: ValidationRunner = async request => {
    const result = await success(request);
    return result.timeouts ? { ...result, timeouts } : result;
  };
  await expect(validateAndPublish(draft, run)).rejects.toThrow("CPU-timeout");
});

it("fails closed on sandbox infrastructure errors", async () => {
  const pool = { query: vi.fn() };
  await expect(validateAndPublish(draft, async () => { throw new Error("Sandbox unavailable"); }, pool as unknown as Pool)).rejects.toThrow("Sandbox unavailable");
  expect(pool.query).not.toHaveBeenCalled();
});

it("requires every benchmark to timeout, even after an earlier benchmark qualifies", async () => {
  const input = structuredClone(draft);
  input.tests.push({ args: [[2, 4]], expected: 2, benchmark: true });
  let slowRuns = 0;
  const pool = { query: vi.fn() };
  const run: ValidationRunner = async request => {
    const result = await success(request);
    if (result.timeouts && ++slowRuns === 2) return { ...result, timeouts: 0 };
    return result;
  };
  await expect(validateAndPublish(input, run, pool as unknown as Pool)).rejects.toThrow("CPU-timeout");
  expect(slowRuns).toBe(2);
  expect(pool.query).not.toHaveBeenCalled();
});

it("publishes all fields atomically, prevents overwrite and stores the validated snapshot", async () => {
  const input = structuredClone(draft);
  const run = async (request: JudgeRequest) => {
    input.title = "Changed during validation";
    return success(request);
  };
  const result = await validateAndPublish(input, run, db as unknown as Pool);
  expect(result.published).toBe(true);
  const { rows } = await db.query<Record<string, unknown>>("SELECT * FROM problems WHERE slug=$1", [draft.slug]);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ title: draft.title, reference_solution: draft.referenceSolution, brute_force_solution: draft.bruteForceSolution,
    topics: draft.topics, cpu_limit_ms: 1000, memory_limit_kb: 65536, examples: draft.examples });
  expect(rows[0].published_at).not.toBeNull();
  expect(rows[0].hidden_tests).toHaveLength(3);
  expect(JSON.parse(rows[0].test_generator as string).validation).toEqual({ version: 1, randomCases: 2000, sha256: result.sha256 });
  await expect(validateAndPublish(draft, success, db as unknown as Pool)).rejects.toThrow();
  expect((await db.query("SELECT * FROM problems")).rows).toHaveLength(1);
});
