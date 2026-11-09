import type { Pool } from "pg";
import { createJudge, type JudgeRequest } from "./judge";
import { scoreMatch, type ScoredSubmission } from "./scoring";
import { rateMatch } from "./rating";
import { solutionError } from "./solution-validation";
import { transaction } from "./db";
import { MATCH_DURATION_SECONDS, type Difficulty } from "./matchmaking";

export class MatchActionError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
/** The match row serializes readiness, admission, and finalization across processes. */
export async function matchAction(pool: Pool, id: string, actor: string, action: "ready" | "submit", source = "") {
  if (!uuid.test(id)) throw new MatchActionError(404, "Match not found.");
  if (action === "submit") {
    const error = solutionError(source);
    if (error) throw new MatchActionError(400, error);
  }
  return transaction(pool, async db => {
    const { rows: [m] } = await db.query(`SELECT m.*, p.difficulty FROM matches m
      JOIN problems p ON p.id=m.problem_id WHERE m.id=$1 FOR UPDATE OF m`, [id]);
    if (!m || ![m.player_one_id, m.player_two_id].includes(actor)) throw new MatchActionError(404, "Match not found.");
    // Read admission time after obtaining the lock, including any lock wait.
    m.time = (await db.query("SELECT clock_timestamp() AS time")).rows[0].time;
    if (action === "ready") {
      if (m.status !== "pending") return { status: m.status };
      if (m.time.getTime() >= m.created_at.getTime() + 60000) {
        await db.query("UPDATE matches SET status='cancelled' WHERE id=$1", [id]);
        return { status: "cancelled" };
      }
      const one = m.player_one_ready || actor === m.player_one_id;
      const two = m.player_two_ready || actor === m.player_two_id;
      const duration = MATCH_DURATION_SECONDS[m.difficulty as Difficulty];
      await db.query(`UPDATE matches SET player_one_ready=$2,player_two_ready=$3,
        status=CASE WHEN $2 AND $3 THEN 'active' ELSE 'pending' END,
        started_at=CASE WHEN $2 AND $3 THEN $4::timestamptz ELSE NULL END,
        deadline_at=CASE WHEN $2 AND $3 THEN $4::timestamptz + $5 * interval '1 second' ELSE NULL END WHERE id=$1`, [id,one,two,m.time,duration]);
      return { status: one && two ? "active" : "pending" };
    }
    if (m.status !== "active" || m.time >= m.deadline_at) throw new MatchActionError(409, "This match is not accepting submissions.");
    const { rows } = await db.query(`SELECT status,submitted_at FROM submissions WHERE match_id=$1 AND user_id=$2 ORDER BY submitted_at DESC`, [id,actor]);
    if (rows.length >= 20 || rows.some(s => s.status !== "judged") || (rows[0] && m.time.getTime()-rows[0].submitted_at.getTime()<5000)) {
      throw new MatchActionError(429, "Wait for judging before submitting again. Limit: 20 submissions per match, five seconds apart.");
    }
    await db.query(`INSERT INTO submissions(match_id,user_id,source_code,submitted_at) VALUES ($1,$2,$3,$4)`, [id,actor,source,m.time]);
    return { status: "queued" };
  });
}

type Run = (request: JudgeRequest, limits: { cpu: number; memory: number }) => Promise<ScoredSubmission>;
export const sandboxRun: Run = (request, limits) => {
  if (!process.env.JUDGE0_URL || !process.env.JUDGE0_PYTHON_LANGUAGE_ID) throw new Error("Isolated sandbox required");
  return createJudge({url:process.env.JUDGE0_URL,pythonLanguageId:Number(process.env.JUDGE0_PYTHON_LANGUAGE_ID),
    authToken:process.env.JUDGE0_AUTH_TOKEN,cpuLimitSeconds:limits.cpu/1000,memoryLimitKb:limits.memory})(request);
};
/** Durable lease + attempt fencing: crashes retry; stale workers cannot overwrite a newer result. */
export async function judgeNext(pool: Pool, run: Run = sandboxRun) {
  const job = await transaction(pool, async db => {
    const { rows: [s] } = await db.query(`SELECT s.id FROM submissions s JOIN matches m ON m.id=s.match_id
      WHERE m.status='active' AND s.status IN ('queued','running','error') AND s.retry_at<=clock_timestamp()
      ORDER BY s.retry_at,s.id LIMIT 1 FOR UPDATE OF s SKIP LOCKED`);
    if (!s) return null;
    const { rows: [job] } = await db.query(`UPDATE submissions SET status='running',attempt=attempt+1,
      retry_at=clock_timestamp()+interval '1 hour' WHERE id=$1 RETURNING *`, [s.id]);
    return job;
  });
  if (!job) return false;
  try {
    const { rows: [p] } = await pool.query(`SELECT p.*,m.started_at FROM matches m JOIN problems p ON p.id=m.problem_id WHERE m.id=$1`, [job.match_id]);
    const submittedAtMs = job.submitted_at.getTime()-p.started_at.getTime();
    const score = await run({source:job.source_code,functionName:/^def\s+([A-Za-z_][A-Za-z0-9_]*)\(/.exec(p.function_signature)?.[1] ?? "",
      tests:p.hidden_tests,submittedAtMs}, {cpu:p.cpu_limit_ms,memory:p.memory_limit_kb});
    // Validate the trusted adapter contract before persisting any result.
    const validated = scoreMatch(score,score);
    if (score.testsTotal !== p.hidden_tests.length || score.submittedAtMs !== submittedAtMs) throw new Error("Invalid judge result");
    await pool.query(`UPDATE submissions SET status='judged',tests_passed=$3,tests_total=$4,largest_test_cpu_ms=$5,cpu_samples=$6::jsonb
      WHERE id=$1 AND attempt=$2 AND status='running'`, [job.id,job.attempt,score.testsPassed,score.testsTotal,validated.playerOneCpuMs,JSON.stringify(score.largestTestsCpuMs)]);
  } catch {
    await pool.query(`UPDATE submissions SET status='error',retry_at=clock_timestamp()+interval '30 seconds'
      WHERE id=$1 AND attempt=$2 AND status='running'`, [job.id,job.attempt]);
  }
  return true;
}

export async function settleMatches(pool: Pool) {
  await pool.query("UPDATE matches SET status='cancelled' WHERE status='pending' AND created_at+interval '60 seconds'<=clock_timestamp()");
  const { rows } = await pool.query("SELECT id FROM matches WHERE status='active' AND deadline_at<=clock_timestamp() ORDER BY id");
  for (const { id } of rows) await transaction(pool, async db => {
    const { rows: [m] } = await db.query(`SELECT m.*,p.hidden_tests,p.cpu_limit_ms FROM matches m JOIN problems p ON p.id=m.problem_id WHERE m.id=$1 FOR UPDATE OF m`, [id]);
    if (m.status !== 'active') return;
    const { rows: submissions } = await db.query("SELECT * FROM submissions WHERE match_id=$1 ORDER BY submitted_at,id", [id]);
    // Infrastructure failures are retried, never turned into a player's loss.
    if (submissions.some(s => s.status !== 'judged')) return;
    const duration = m.deadline_at.getTime()-m.started_at.getTime();
    const fallbackCpu = m.hidden_tests.filter((t: {benchmark?:boolean}) => t.benchmark).length*m.cpu_limit_ms;
    const choose = (user: string) => {
      const candidates = submissions.filter(s => s.user_id === user).map(s => ({testsPassed:s.tests_passed,testsTotal:s.tests_total,
        largestTestsCpuMs:s.cpu_samples,submittedAtMs:s.submitted_at.getTime()-m.started_at.getTime()} as ScoredSubmission));
      return candidates.reduce<ScoredSubmission | null>((best,s) => !best || scoreMatch(s,best).winner === 'playerOne' ? s : best,null);
    };
    const selected = [choose(m.player_one_id),choose(m.player_two_id)];
    const scores = selected.map(s => s ?? {testsPassed:0,testsTotal:m.hidden_tests.length,largestTestsCpuMs:[fallbackCpu,fallbackCpu,fallbackCpu] as const,submittedAtMs:duration});
    const result = scoreMatch(scores[0],scores[1]);
    const { rows: users } = await db.query("SELECT * FROM users WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE", [[m.player_one_id,m.player_two_id]]);
    const one = users.find(u => u.id===m.player_one_id)!; const two = users.find(u => u.id===m.player_two_id)!;
    const rating = (u: typeof one) => ({rating:u.rating,deviation:u.rating_deviation,volatility:u.volatility});
    const rated = rateMatch(rating(one),rating(two),result.winner);
    for (const [i,u] of [one,two].entries()) {
      const next = i===0 ? rated.playerOne : rated.playerTwo;
      await db.query("UPDATE users SET rating=$2,rating_deviation=$3,volatility=$4 WHERE id=$1", [u.id,next.rating,next.deviation,next.volatility]);
      await db.query("INSERT INTO rating_history(user_id,match_id,rating_before,rating_after) VALUES ($1,$2,$3,$4)",[u.id,id,u.rating,next.rating]);
      await db.query("INSERT INTO match_results VALUES ($1,$2,$3,$4,$5,$6)",[id,u.id,scores[i].testsPassed,scores[i].testsTotal,i===0 ? result.playerOneCpuMs : result.playerTwoCpuMs,selected[i]?.submittedAtMs ?? null]);
    }
    await db.query("UPDATE matches SET status='completed',completed_at=clock_timestamp(),winner_id=$2 WHERE id=$1", [id,result.winner===null ? null : result.winner==='playerOne' ? one.id : two.id]);
  });
}
