import { isDeepStrictEqual } from "node:util";
import type { ScoredSubmission } from "./scoring";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export interface JudgeTest { args: Json[]; expected: Json; benchmark?: boolean }
export interface JudgeRequest {
  source: string;
  functionName: string;
  tests: readonly JudgeTest[];
  submittedAtMs: number;
}
export interface JudgeConfig {
  /** Trusted server configuration, never supplied by a player. */
  url: string;
  pythonLanguageId: number;
  authToken?: string;
  cpuLimitSeconds: number;
  memoryLimitKb: number;
  requestTimeoutMs?: number;
  maxPolls?: number;
  pollIntervalMs?: number;
  /** Server-side diagnostics for catalog validation; never supplied by players. */
  onExecutionStatus?: (status: number) => void;
}
export class JudgeUnavailableError extends Error {
  constructor() { super("Sandbox judge unavailable; submission must not be scored."); }
}

function jsonValue(value: unknown): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return Array.from(value).every(jsonValue);
  return typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype && Object.values(value).every(jsonValue);
}

/** Server-only Judge0 adapter. No local execution or fallback is permitted. */
export function createJudge(config: JudgeConfig, fetcher: typeof fetch = fetch) {
  const url = new URL(config.url);
  const timeout = config.requestTimeoutMs ?? 10_000;
  const maxPolls = config.maxPolls ?? 120;
  const pollInterval = config.pollIntervalMs ?? 250;
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash ||
      !Number.isSafeInteger(config.pythonLanguageId) || config.pythonLanguageId <= 0 ||
      !Number.isFinite(config.cpuLimitSeconds) || config.cpuLimitSeconds <= 0 ||
      !Number.isSafeInteger(config.memoryLimitKb) || config.memoryLimitKb <= 0 ||
      !Number.isSafeInteger(timeout) || timeout <= 0 || !Number.isSafeInteger(maxPolls) || maxPolls <= 0 ||
      !Number.isSafeInteger(pollInterval) || pollInterval < 0) throw new RangeError("Invalid judge configuration.");
  const base = config.url.replace(/\/$/, "");

  async function api(path: string, body?: object) {
    try {
      const response = await fetcher(`${base}${path}`, {
        method: body ? "POST" : "GET",
        headers: { "Content-Type": "application/json", ...(config.authToken ? { "X-Auth-Token": config.authToken } : {}) },
        signal: AbortSignal.timeout(timeout),
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!response.ok) throw new JudgeUnavailableError();
      return await response.json();
    } catch { throw new JudgeUnavailableError(); }
  }

  return async function judge(request: JudgeRequest): Promise<ScoredSubmission> {
    if (typeof request.source !== "string" || !request.source.trim() || request.source.length > 65_536 ||
        !/^[A-Za-z_][A-Za-z0-9_]*$/.test(request.functionName) ||
        !Number.isFinite(request.submittedAtMs) || request.submittedAtMs < 0 ||
        !Array.isArray(request.tests) || !request.tests.length || request.tests.length > 1000 ||
        !request.tests.some(test => test.benchmark === true) ||
        !Array.from(request.tests).every(test => test && Array.isArray(test.args) && jsonValue(test.args) && jsonValue(test.expected))) {
      throw new RangeError("Invalid judge request; include JSON tests and a largest-test benchmark.");
    }
    // Expected answers stay on the server. Only arguments are sent to the sandbox.
    const source = `import json, sys\n_payload = json.loads(sys.stdin.read())\n_namespace = {}\nexec(compile(${JSON.stringify(request.source)}, '<submission>', 'exec'), _namespace)\n_result = _namespace[${JSON.stringify(request.functionName)}](*_payload)\nprint(json.dumps(_result, allow_nan=False))\n`;
    async function run(test: JudgeTest) {
      const created = await api("/submissions?base64_encoded=true&wait=false", {
        source_code: Buffer.from(source).toString("base64"),
        stdin: Buffer.from(JSON.stringify(test.args)).toString("base64"),
        language_id: config.pythonLanguageId, cpu_time_limit: config.cpuLimitSeconds,
        cpu_extra_time: 0, wall_time_limit: Math.max(5, config.cpuLimitSeconds * 5),
        memory_limit: config.memoryLimitKb, stack_limit: config.memoryLimitKb,
        max_processes_and_or_threads: 1, max_file_size: 64, enable_network: false,
        enable_per_process_and_thread_time_limit: false,
        enable_per_process_and_thread_memory_limit: false,
        number_of_runs: 1, redirect_stderr_to_stdout: false,
      });
      if (typeof created?.token !== "string" || !created.token) throw new JudgeUnavailableError();
      for (let poll = 0; poll < maxPolls; poll++) {
        const result = await api(`/submissions/${encodeURIComponent(created.token)}?base64_encoded=true&fields=status,time,stdout`);
        const status = result?.status?.id;
        if (status === 1 || status === 2) {
          if (poll + 1 < maxPolls) await new Promise(resolve => setTimeout(resolve, pollInterval));
          continue;
        }
        if (!Number.isInteger(status) || status < 3 || status > 12) throw new JudgeUnavailableError();
        config.onExecutionStatus?.(status);
        // Failed programs get the full limit, so immediate crashes cannot win on CPU.
        if (status !== 3) return { passed: false, cpuMs: config.cpuLimitSeconds * 1000 };
        if (typeof result.time !== "string" || !/^(\d+)(\.\d+)?$/.test(result.time) || !Number.isFinite(Number(result.time))) throw new JudgeUnavailableError();
        let passed = false;
        try {
          if (typeof result.stdout === "string") passed = isDeepStrictEqual(JSON.parse(Buffer.from(result.stdout, "base64").toString("utf8")), test.expected);
        } catch { /* Malformed or non-JSON output fails this test. */ }
        return { passed, cpuMs: passed ? Number(result.time) * 1000 : config.cpuLimitSeconds * 1000 };
      }
      throw new JudgeUnavailableError();
    }
    // Three independent runs, rather than Judge0's averaging option.
    const samples: [number, number, number] = [0, 0, 0];
    let testsPassed = 0;
    for (const test of request.tests) {
      const first = await run(test);
      if (!test.benchmark) { testsPassed += Number(first.passed); continue; }
      const second = await run(test);
      const third = await run(test);
      testsPassed += Number(first.passed && second.passed && third.passed);
      [first, second, third].forEach((result, index) => { samples[index] += result.cpuMs; });
    }
    return { testsPassed, testsTotal: request.tests.length, largestTestsCpuMs: samples, submittedAtMs: request.submittedAtMs };
  };
}
