// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ validate: vi.fn(), end: vi.fn(), pool: vi.fn() }));
vi.mock("pg", () => ({ Pool: class { constructor() { mocks.pool(); } end = mocks.end; } }));
vi.mock("../src/lib/problem-pipeline", async importOriginal => ({
  ...await importOriginal<typeof import("../src/lib/problem-pipeline")>(),
  validateAndPublish: mocks.validate,
}));
const argv = process.argv;
const exitCode = process.exitCode;
afterEach(() => {
  process.argv = argv;
  process.exitCode = exitCode;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

async function run(mode: string) {
  vi.resetModules();
  vi.stubEnv("JUDGE0_URL", "https://sandbox.invalid");
  vi.stubEnv("JUDGE0_PYTHON_LANGUAGE_ID", "71");
  vi.stubEnv("JUDGE0_AUTH_TOKEN", "secret-must-not-be-printed");
  vi.stubEnv("DATABASE_URL", "postgres://private-database");
  process.argv = ["node", "scripts/problems.ts", mode, "problems/drafts/relay-basin-storage.json"];
  await import("../scripts/problems");
}

it.each(["validate", "publish"])("reports sandbox failure safely for %s and releases database resources", async mode => {
  // Import after resetModules so the CLI and fixture use the same error class.
  mocks.validate.mockImplementation(async () => { const judge = await import("../src/lib/judge"); throw new judge.JudgeUnavailableError(); });
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  await run(mode);
  expect(process.exitCode).toBe(1);
  expect(error).toHaveBeenCalledTimes(1);
  const message = error.mock.calls[0][0];
  expect(message).toMatch(/No problem was published/);
  expect(message).toMatch(/isolated Judge0.*JUDGE0_URL.*JUDGE0_PYTHON_LANGUAGE_ID.*JUDGE0_AUTH_TOKEN/);
  expect(message).toMatch(/Do not run draft solutions on the host.*Retry the same command/);
  expect(message).not.toContain("secret-must-not-be-printed");
  expect(message).not.toContain("private-database");
  expect(log).not.toHaveBeenCalled();
  expect(mocks.end).toHaveBeenCalledTimes(mode === "publish" ? 1 : 0);
});

it("keeps unrelated validation failures visible and closes the publication pool", async () => {
  const failure = new Error("Reference disagrees with brute force");
  mocks.validate.mockRejectedValue(failure);
  await expect(run("publish")).rejects.toBe(failure);
  expect(mocks.end).toHaveBeenCalledTimes(1);
});

it("prints successful validation results without failure guidance", async () => {
  mocks.validate.mockResolvedValue({ validated: true });
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  await run("validate");
  expect(JSON.parse(log.mock.calls[0][0])).toEqual({ validated: true });
  expect(error).not.toHaveBeenCalled();
});
