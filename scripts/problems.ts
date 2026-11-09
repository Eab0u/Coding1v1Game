import { readFile, stat } from "node:fs/promises";
import { Pool } from "pg";
import { createJudge, JudgeUnavailableError } from "../src/lib/judge";
import { parseProblemDraft, validateAndPublish } from "../src/lib/problem-pipeline";

const [mode, path, ...extra] = process.argv.slice(2);
if (!["validate", "publish"].includes(mode) || !path || extra.length) {
  throw new Error("Usage: npm run problems -- <validate|publish> <draft.json>");
}
if (!process.env.JUDGE0_URL || !process.env.JUDGE0_PYTHON_LANGUAGE_ID) throw new Error("An isolated Judge0 deployment is required");
if (mode === "publish" && !process.env.DATABASE_URL) throw new Error("DATABASE_URL is required to publish");
if ((await stat(path)).size > 4_000_000) throw new Error("Draft exceeds 4 MB");
const draft = parseProblemDraft(JSON.parse(await readFile(path, "utf8")));
let timeouts = 0;
const judge = createJudge({
  url: process.env.JUDGE0_URL,
  pythonLanguageId: Number(process.env.JUDGE0_PYTHON_LANGUAGE_ID),
  authToken: process.env.JUDGE0_AUTH_TOKEN,
  cpuLimitSeconds: draft.cpuLimitMs / 1000,
  memoryLimitKb: draft.memoryLimitKb,
  onExecutionStatus: status => { if (status === 5) timeouts++; },
});
const pool = mode === "publish" ? new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000, statement_timeout: 10_000 }) : undefined;
try {
  const result = await validateAndPublish(draft, async request => {
    timeouts = 0;
    const score = await judge(request);
    return { score, timeouts };
  }, pool);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  if (!(error instanceof JudgeUnavailableError)) throw error;
  console.error("Sandbox validation could not complete. No problem was published. Check that your isolated Judge0 deployment is running and reachable, and verify JUDGE0_URL, JUDGE0_PYTHON_LANGUAGE_ID and JUDGE0_AUTH_TOKEN in your environment. Do not run draft solutions on the host. Retry the same command after restoring the sandbox.");
  process.exitCode = 1;
} finally { await pool?.end(); }
