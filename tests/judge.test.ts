// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createJudge, JudgeUnavailableError, type JudgeConfig, type JudgeRequest } from "../src/lib/judge";
import { scoreMatch } from "../src/lib/scoring";

const config: JudgeConfig = { url: "https://sandbox.example", pythonLanguageId: 71, cpuLimitSeconds: 2, memoryLimitKb: 128000, pollIntervalMs: 0, maxPolls: 2, authToken: "test-only" };
const request: JudgeRequest = { source: "def solve(x):\n    return x", functionName: "solve", tests: [{ args: [42], expected: 42, benchmark: true }], submittedAtMs: 150 };
const done = (value: unknown = 42, time = "0.012") => ({ status: { id: 3 }, stdout: Buffer.from(JSON.stringify(value)).toString("base64"), time, wall_time: "999" });
function sandbox(results: unknown[]) {
  const pending = [...results];
  return vi.fn<typeof fetch>(async (_url, init) => new Response(JSON.stringify(init?.method === "POST" ? { token: "sandbox-token" } : pending.shift()), { status: 200 }));
}

describe("sandbox judge", () => {
  it("reports final execution statuses so catalog validation distinguishes timeouts from crashes", async () => {
    const onExecutionStatus = vi.fn();
    await createJudge({ ...config, onExecutionStatus }, sandbox([{ status: { id: 1 } }, { status: { id: 5 } }, { status: { id: 7 } }, done()]))(request);
    expect(onExecutionStatus.mock.calls).toEqual([[5], [7], [3]]);
  });
  it("runs benchmarks independently three times and returns scorer-compatible CPU milliseconds", async () => {
    const fetcher = sandbox([done(42, "0.030"), done(42, "0.010"), done(42, "0.020")]);
    const result = await createJudge(config, fetcher)(request);
    expect(result).toEqual({ testsPassed: 1, testsTotal: 1, largestTestsCpuMs: [30, 10, 20], submittedAtMs: 150 });
    expect(scoreMatch(result, result).playerOneCpuMs).toBe(20);
    expect(fetcher).toHaveBeenCalledTimes(6);
    const init = fetcher.mock.calls[0][1]!;
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ language_id: 71, enable_network: false, cpu_time_limit: 2, memory_limit: 128000, number_of_runs: 1, max_processes_and_or_threads: 1, max_file_size: 64 });
    expect(init.headers).toMatchObject({ "X-Auth-Token": "test-only" });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(Buffer.from(body.stdin, "base64").toString()).toBe("[42]");
    expect(body).not.toHaveProperty("expected_output");
    expect(Buffer.from(body.source_code, "base64").toString()).toContain("_namespace[\"solve\"](*_payload)");
  });

  it("counts ordinary tests once and sums multiple benchmark suites", async () => {
    const fetcher = sandbox([done(), done(), done(), done(), done(), done(), done()]);
    const result = await createJudge(config, fetcher)({ ...request, tests: [{ args: [], expected: 42 }, ...request.tests, ...request.tests] });
    expect(result.testsPassed).toBe(3);
    expect(result.largestTestsCpuMs).toEqual([24, 24, 24]);
  });

  it("polls queued and running submissions", async () => {
    const fetcher = sandbox([{ status: { id: 1 } }, done(), { status: { id: 2 } }, done(), done()]);
    expect((await createJudge(config, fetcher)(request)).testsPassed).toBe(1);
  });

  it.each([4, 5, 6, 7, 8, 9, 10, 11, 12])("counts status %s as a failed test with full CPU penalty", async id => {
    const result = await createJudge(config, sandbox([{ status: { id } }, done(), done()]))(request);
    expect(result.testsPassed).toBe(0);
    expect(result.largestTestsCpuMs).toEqual([2000, 12, 12]);
  });

  it.each([done(43), { ...done(), stdout: Buffer.from("debug\n42").toString("base64") }, { ...done(), stdout: null }])("rejects incorrect or malformed output", async output => {
    expect((await createJudge(config, sandbox([output, output, output]))(request)).testsPassed).toBe(0);
  });

  it("compares objects without depending on key order", async () => {
    const output = done({ b: [2], a: 1 });
    expect((await createJudge(config, sandbox([output, output, output]))({ ...request, tests: [{ args: [], expected: { a: 1, b: [2] }, benchmark: true }] })).testsPassed).toBe(1);
  });

  it.each([{ status: { id: 13 } }, { status: { id: 3 }, time: null }, done(42, "NaN"), {}, { status: { id: 1 } }])("never scores invalid or unfinished infrastructure responses", async output => {
    await expect(createJudge(config, sandbox([output, output]))(request)).rejects.toBeInstanceOf(JudgeUnavailableError);
  });

  it.each([401, 422, 500])("fails closed on HTTP %s", async status => {
    await expect(createJudge(config, vi.fn(async () => new Response("private details", { status })))(request)).rejects.toThrow("Sandbox judge unavailable");
  });
  it("redacts transport errors and rejects missing submission tokens", async () => {
    await expect(createJudge(config, vi.fn(async () => { throw new Error("secret"); }))(request)).rejects.toThrow("Sandbox judge unavailable");
    await expect(createJudge(config, vi.fn(async () => new Response("{}")))(request)).rejects.toBeInstanceOf(JudgeUnavailableError);
  });

  it.each([{ functionName: "solve(); bad" }, { source: "" }, { submittedAtMs: -1 }, { tests: [] }, { tests: [{ args: [], expected: 42 }] }, { tests: [{ args: [NaN], expected: 42, benchmark: true }] }])("rejects invalid requests before network access", async change => {
    const fetcher = sandbox([]);
    await expect(createJudge(config, fetcher)({ ...request, ...change })).rejects.toBeInstanceOf(RangeError);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([{ url: "file:///sandbox" }, { cpuLimitSeconds: 0 }, { pythonLanguageId: 0 }, { memoryLimitKb: -1 }, { maxPolls: 0 }, { requestTimeoutMs: 0 }])("rejects invalid configuration", change => {
    expect(() => createJudge({ ...config, ...change })).toThrow(RangeError);
  });
});
