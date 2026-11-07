import { Pool } from "pg";
import { judgeNext, settleMatches } from "../src/lib/match-lifecycle";
if (!process.env.DATABASE_URL || !process.env.JUDGE0_URL || !process.env.JUDGE0_PYTHON_LANGUAGE_ID) throw new Error("Database and isolated Judge0 configuration required");
const pool = new Pool({connectionString:process.env.DATABASE_URL,max:5,connectionTimeoutMillis:5000,statement_timeout:10000});
let stopped = false;
process.on('SIGTERM',()=>{stopped=true;});
process.on('SIGINT',()=>{stopped=true;});
try {
  // A long sandbox run must not delay reservation expiry or other match results.
  await Promise.all([
    (async()=>{ while (!stopped) {
      try { await settleMatches(pool); } catch { console.error('Match settlement unavailable; retrying.'); }
      await new Promise(resolve=>setTimeout(resolve,1000));
    } })(),
    (async()=>{ while (!stopped) {
      try { if (await judgeNext(pool)) continue; } catch { console.error('Judge queue unavailable; retrying.'); }
      await new Promise(resolve=>setTimeout(resolve,1000));
    } })(),
  ]);
} finally { await pool.end(); }
