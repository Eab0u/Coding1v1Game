// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createServer } from "node:http";
import { once } from "node:events";
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
  it.each([true, false])("snapshots nested tests and scoring metadata during execution (correct=%s)", async correct => {
    const expected = { values: [42] };
    const tests = [
      { args: [{ values: [1] }], expected, benchmark: true },
      { args: [{ values: [2] }], expected, benchmark: false },
    ];
    const input = { ...request, tests };
    const responses = sandbox(Array.from({ length: 4 }, () => done({ values: [correct ? 42 : 99] })));
    const fetcher = vi.fn<typeof fetch>(async (url, init) => {
      tests[0].args[0].values[0] = 999;
      tests[1].args[0].values[0] = 999;
      expected.values[0] = 99;
      tests[0].benchmark = false;
      tests[1].benchmark = true;
      tests.push(tests[0]);
      input.tests = [];
      input.submittedAtMs = NaN;
      input.source = "changed source";
      input.functionName = "changed_function";
      return responses(url, init);
    });
    expect(await createJudge(config, fetcher)(input)).toEqual({
      testsPassed: correct ? 2 : 0, testsTotal: 2,
      largestTestsCpuMs: correct ? [12, 12, 12] : [2000, 2000, 2000], submittedAtMs: 150,
    });
    const bodies = fetcher.mock.calls.filter(([, init]) => init?.method === "POST")
      .map(([, init]) => JSON.parse(init!.body as string));
    expect(bodies.map(body => JSON.parse(Buffer.from(body.stdin, "base64").toString()))).toEqual([
      [{ values: [1] }], [{ values: [1] }], [{ values: [1] }], [{ values: [2] }],
    ]);
    for (const body of bodies) {
      const source = Buffer.from(body.source_code, "base64").toString();
      expect(source).toContain('def solve(x):');
      expect(source).toContain('_namespace["solve"]');
    }
    expect(fetcher).toHaveBeenCalledTimes(8);
  });

  it.each(["before execution", "during execution"])("retains validated configuration when callers mutate settings %s", async timing => {
    const originalStatus = vi.fn();
    const replacementStatus = vi.fn();
    const settings = { ...config, onExecutionStatus: originalStatus };
    const mutate = () => Object.assign(settings, {
      url: "https://changed.example", authToken: "changed-token", pythonLanguageId: -1,
      cpuLimitSeconds: Infinity, memoryLimitKb: -1, maxPolls: 0,
      requestTimeoutMs: 0, pollIntervalMs: -1, onExecutionStatus: replacementStatus,
    });
    const responses = sandbox(Array.from({ length: 6 }, () => ({ status: { id: 5 } })));
    const fetcher = vi.fn<typeof fetch>(async (url, init) => {
      if (timing === "during execution") mutate();
      return responses(url, init);
    });
    const judge = createJudge(settings, fetcher);
    if (timing === "before execution") mutate();
    for (let run = 0; run < 2; run++) {
      expect(await judge(request)).toEqual({
        testsPassed: 0, testsTotal: 1, largestTestsCpuMs: [2000, 2000, 2000], submittedAtMs: 150,
      });
    }
    expect(originalStatus).toHaveBeenCalledTimes(6);
    expect(replacementStatus).not.toHaveBeenCalled();
    for (const [url, init] of fetcher.mock.calls) {
      expect(String(url)).toMatch(/^https:\/\/sandbox\.example\/submissions/);
      expect(init?.headers).toMatchObject({ "X-Auth-Token": "test-only" });
      if (init?.method === "POST") expect(JSON.parse(init.body as string)).toMatchObject({
        language_id: 71, cpu_time_limit: 2, wall_time_limit: 10, memory_limit: 128000, stack_limit: 128000,
      });
    }
  });

  it.each(["requestTimeoutMs", "pollIntervalMs"] as const)("rejects overflowing %s before network access", field => {
    const fetcher = vi.fn<typeof fetch>();
    for (const delay of [2_147_483_648, Number.MAX_SAFE_INTEGER]) {
      expect(() => createJudge({ ...config, [field]: delay }, fetcher)).toThrow("Invalid judge configuration.");
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("accepts the maximum supported timer delay and preserves successful scoring", async () => {
    const fetcher = sandbox([done(), done(), done()]);
    const judge = createJudge({ ...config, requestTimeoutMs: 2_147_483_647, pollIntervalMs: 2_147_483_647 }, fetcher);
    expect((await judge(request)).testsPassed).toBe(1);
    expect(fetcher).toHaveBeenCalledTimes(6);
  });

  it.each(["POST", "GET"])("never follows %s redirects or forwards sandbox credentials", async redirectedMethod => {
    const received: string[] = [];
    const server = createServer((req, res) => {
      received.push(`${req.method} ${req.url}`);
      if (req.url === "/redirect-target") {
        res.end(JSON.stringify(done()));
      } else if (req.method === redirectedMethod) {
        res.writeHead(307, { Location: "/redirect-target?secret=private-token" });
        res.end("private response details");
      } else {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ token: "sandbox-token" }));
      }
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    try {
      const address = server.address() as { port: number };
      await expect(createJudge({ ...config, url: `http://127.0.0.1:${address.port}` })(request))
        .rejects.toThrow("Sandbox judge unavailable; submission must not be scored.");
      expect(received).toEqual(redirectedMethod === "POST"
        ? ["POST /submissions?base64_encoded=true&wait=false"]
        : ["POST /submissions?base64_encoded=true&wait=false", "GET /submissions/sandbox-token?base64_encoded=true&fields=status,time,stdout"]);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });
  it.each([
    "private-token@invalid-host",
    "https://private-user:private-password@[invalid",
    "https://sandbox.example:invalid/private-token",
    "",
    "https://private-user:private-password@sandbox.example",
    "https://sandbox.example?token=private-token",
    "https://sandbox.example#private-token",
  ])("rejects unsafe URLs without retaining configuration secrets (%#)", url => {
    const fetcher = vi.fn<typeof fetch>();
    let failure: unknown;
    try { createJudge({ ...config, url }, fetcher); } catch (error) { failure = error; }
    expect(failure).toBeInstanceOf(RangeError);
    expect((failure as Error).message).toBe("Invalid judge configuration.");
    expect((failure as Error).cause).toBeUndefined();
    expect(Object.getOwnPropertyNames(failure)).not.toContain("input");
    expect(String((failure as Error).stack)).not.toMatch(/private-token|private-user|private-password/);
    expect(fetcher).not.toHaveBeenCalled();
  });
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
    expect(fetcher.mock.calls.every(([, options]) => options?.redirect === "error")).toBe(true);
    expect(Buffer.from(body.stdin, "base64").toString()).toBe("[42]");
    expect(body).not.toHaveProperty("expected_output");
    expect(Buffer.from(body.source_code, "base64").toString()).toContain("_namespace[\"solve\"](*_payload)");
  });

  it.each([true, false])("rejects CPU conversion overflow before scoring (correct=%s)", async correct => {
    const fetcher = sandbox([done(correct ? 42 : 43, "1" + "0".repeat(306))]);
    await expect(createJudge(config, fetcher)(request)).rejects.toBeInstanceOf(JudgeUnavailableError);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("rejects benchmark total overflow even when individual CPU samples are finite", async () => {
    const output = done(42, "6" + "0".repeat(304));
    const fetcher = sandbox(Array.from({ length: 9 }, () => output));
    await expect(createJudge(config, fetcher)({ ...request, tests: Array.from({ length: 3 }, () => request.tests[0]) }))
      .rejects.toBeInstanceOf(JudgeUnavailableError);
    expect(fetcher).toHaveBeenCalledTimes(18);
  });

  it("rejects CPU limits that overflow milliseconds before making requests", () => {
    const fetcher = vi.fn<typeof fetch>();
    expect(() => createJudge({ ...config, cpuLimitSeconds: Number.MAX_VALUE }, fetcher)).toThrow("Invalid judge configuration.");
    expect(fetcher).not.toHaveBeenCalled();
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

  it.each(["NDI=garbage", "N!DI=", "NDI=\n", "NDI", "NDJ="])("fails malformed base64 output with the full CPU penalty (%s)", async stdout => {
    const output = { ...done(), stdout };
    const result = await createJudge(config, sandbox([output, done(), done()]))(request);
    expect(result.testsPassed).toBe(0);
    expect(result.largestTestsCpuMs).toEqual([2000, 12, 12]);
  });

  it.each([{ bytes: [0x22, 0xff, 0x22] }, { bytes: [0x22, 0xc0, 0xaf, 0x22] }, { bytes: [0x22, 0xe2, 0x82, 0x22] }])("fails invalid UTF-8 instead of comparing replacement characters ($bytes)", async ({ bytes }) => {
    const buffer = Buffer.from(bytes);
    const output = { ...done(), stdout: buffer.toString("base64") };
    const result = await createJudge(config, sandbox([output, output, output]))({
      ...request, tests: [{ args: [], expected: JSON.parse(buffer.toString("utf8")), benchmark: true }],
    });
    expect(result.testsPassed).toBe(0);
    expect(result.largestTestsCpuMs).toEqual([2000, 2000, 2000]);
  });

  it.each(["signal \uFFFD \u{1F6A6}", { label: "café", values: [true, null, 42] }])("preserves valid Unicode and structured output (%j)", async expected => {
    const output = done(expected);
    const result = await createJudge(config, sandbox([output, output, output]))({
      ...request, tests: [{ args: [], expected, benchmark: true }],
    });
    expect(result.testsPassed).toBe(1);
    expect(result.largestTestsCpuMs).toEqual([12, 12, 12]);
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
