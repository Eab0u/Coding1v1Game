import { createHash } from "node:crypto";
import type { Pool } from "pg";
import type { JudgeRequest, JudgeTest } from "./judge";
import type { ScoredSubmission } from "./scoring";

type ArgumentGenerator = { kind: "integer"; min: number; max: number } |
  { kind: "integer-array"; min: number; max: number; minLength: number; maxLength: number };
export interface ProblemDraft {
  slug: string; title: string; statement: string; functionSignature: string; functionName: string;
  difficulty: "easy" | "medium" | "hard"; topics: string[]; constraints: string;
  examples: { args: JudgeTest["args"]; expected: JudgeTest["expected"]; explanation: string }[];
  referenceSolution: string; bruteForceSolution: string;
  generator: { seed: number; args: ArgumentGenerator[] };
  tests: JudgeTest[]; cpuLimitMs: number; memoryLimitKb: number;
}
export type ValidationRunner = (request: JudgeRequest) => Promise<{ score: ScoredSubmission; timeouts: number }>;

function integer(value: number, min: number, max: number) {
  return Number.isSafeInteger(value) && value >= min && value <= max;
}
/** Parse JSON only. Generator descriptions are data, never locally executed code. */
export function parseProblemDraft(input: unknown): ProblemDraft {
  const draft = input as ProblemDraft;
  const fail = () => { throw new Error("Invalid problem draft"); };
  if (!draft || typeof draft !== "object") fail();
  for (const key of ["slug", "title", "statement", "functionSignature", "functionName", "constraints", "referenceSolution", "bruteForceSolution"] as const) {
    if (typeof draft[key] !== "string" || !draft[key].trim() || draft[key].length > 32_000) fail();
  }
  if (!/^[a-z][a-z0-9-]{1,79}$/.test(draft.slug) || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(draft.functionName) ||
      !draft.functionSignature.startsWith(`def ${draft.functionName}(`) ||
      !["easy", "medium", "hard"].includes(draft.difficulty) ||
      !Array.isArray(draft.topics) || !draft.topics.length || !draft.topics.every(t => typeof t === "string" && t.length > 0 && t.length <= 80) ||
      !integer(draft.cpuLimitMs, 100, 30_000) || !integer(draft.memoryLimitKb, 16_384, 262_144)) fail();
  if (!draft.generator || !integer(draft.generator.seed, 0, 0xffffffff) || !Array.isArray(draft.generator.args) ||
      !draft.generator.args.length || draft.generator.args.length > 8) fail();
  for (const spec of draft.generator.args) {
    if (!spec || !["integer", "integer-array"].includes(spec.kind) || !integer(spec.min, -1_000_000, 1_000_000) ||
        !integer(spec.max, spec.min, 1_000_000)) fail();
    if (spec.kind === "integer-array" && (!integer(spec.minLength, 0, 50) || !integer(spec.maxLength, spec.minLength, 50))) fail();
  }
  const json = (value: unknown): boolean => value === null || typeof value === "boolean" || typeof value === "string" ||
    (typeof value === "number" && Number.isFinite(value)) || (Array.isArray(value) && value.every(json)) ||
    (typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype && Object.values(value).every(json));
  const test = (value: JudgeTest) => value && Array.isArray(value.args) && value.args.length === draft.generator.args.length && json(value.args) && json(value.expected);
  if (!Array.isArray(draft.examples) || !draft.examples.length || draft.examples.length > 10 ||
      !draft.examples.every(e => test(e) && typeof e.explanation === "string" && e.explanation.trim())) fail();
  if (!Array.isArray(draft.tests) || draft.tests.length < 2 || draft.tests.length > 100 ||
      !draft.tests.every(t => test(t) && (t.benchmark === undefined || typeof t.benchmark === "boolean")) ||
      !draft.tests.some(t => t.benchmark === true) || !draft.tests.some(t => !t.benchmark)) fail();
  if (Buffer.byteLength(JSON.stringify(draft)) > 4_000_000) fail();
  return structuredClone(draft);
}

export function generateSmallCases(draft: ProblemDraft, count = 2000): JudgeTest["args"][] {
  if (!integer(count, 2000, 10_000)) throw new Error("Require 2000–10000 random cases");
  let state = draft.generator.seed;
  const next = (min: number, max: number) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return min + Math.floor((state / 0x100000000) * (max - min + 1));
  };
  return Array.from({ length: count }, () => draft.generator.args.map(spec => spec.kind === "integer" ? next(spec.min, spec.max) :
    Array.from({ length: next(spec.minLength, spec.maxLength) }, () => next(spec.min, spec.max))));
}

/** The only publication path validates the exact snapshot it inserts, with no cached approval token. */
export async function validateAndPublish(input: unknown, run: ValidationRunner, pool?: Pick<Pool, "query">) {
  const draft = parseProblemDraft(input);
  const cases = generateSmallCases(draft);
  // Separate namespaces and fresh arguments prevent mutation from contaminating comparisons.
  const comparison = `import json\ndef validate_cases(cases):\n a = {}\n b = {}\n exec(${JSON.stringify(draft.referenceSolution)}, a)\n exec(${JSON.stringify(draft.bruteForceSolution)}, b)\n for args in cases:\n  x = a[${JSON.stringify(draft.functionName)}](*json.loads(json.dumps(args)))\n  y = b[${JSON.stringify(draft.functionName)}](*json.loads(json.dumps(args)))\n  if json.dumps(x, sort_keys=True, allow_nan=False) != json.dumps(y, sort_keys=True, allow_nan=False):\n   return False\n return True\n`;
  const check = async (source: string, functionName: string, tests: JudgeTest[]) => {
    const result = await run({ source, functionName, tests, submittedAtMs: 0 });
    if (result.score.testsTotal !== tests.length || result.score.testsPassed !== tests.length) throw new Error("Solution validation failed");
  };
  // Batches keep each sandbox invocation bounded. The judge repeats benchmark tests three times.
  for (let i = 0; i < cases.length; i += 100) {
    await check(comparison, "validate_cases", [{ args: [cases.slice(i, i + 100)], expected: true, benchmark: true }]);
  }
  const examples: JudgeTest[] = draft.examples.map(({ args, expected }) => ({ args, expected }));
  const suite: JudgeTest[] = [...examples, ...draft.tests];
  await check(draft.referenceSolution, draft.functionName, suite);
  // Both algorithms must also match the authored examples and non-benchmark edge cases.
  const small = suite.filter(t => !t.benchmark).map((t, i) => ({ ...t, benchmark: i === 0 }));
  await check(draft.bruteForceSolution, draft.functionName, small);
  const large = draft.tests.filter(t => t.benchmark);
  for (const test of large) {
    const slow = await run({ source: draft.bruteForceSolution, functionName: draft.functionName, tests: [test], submittedAtMs: 0 });
    if (slow.timeouts !== 3 || slow.score.testsPassed !== 0 || slow.score.testsTotal !== 1) {
      throw new Error("Brute force must CPU-timeout on all three runs of every benchmark");
    }
  }
  const digest = createHash("sha256").update(JSON.stringify(draft)).digest("hex");
  if (pool) {
    // Insert only: changing a published suite would invalidate existing matches. Use a new slug for revisions.
    await pool.query(`INSERT INTO problems
      (slug,title,statement,function_signature,difficulty,topics,examples,constraints,reference_solution,brute_force_solution,test_generator,hidden_tests,cpu_limit_ms,memory_limit_kb,published_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12::jsonb,$13,$14,now())`,
    [draft.slug, draft.title, draft.statement, draft.functionSignature, draft.difficulty, draft.topics,
      JSON.stringify(draft.examples), draft.constraints, draft.referenceSolution, draft.bruteForceSolution,
      JSON.stringify({ ...draft.generator, validation: { version: 1, randomCases: cases.length, sha256: digest } }),
      JSON.stringify(suite), draft.cpuLimitMs, draft.memoryLimitKb]);
  }
  return { slug: draft.slug, sha256: digest, randomCases: cases.length, hiddenTests: suite.length, published: Boolean(pool) };
}
