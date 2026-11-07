import { Pool } from "pg";
import { createAuth } from "../src/lib/auth";
import { createMatchStore } from "../src/lib/matchmaking-store";
import { createMatchmakingServer } from "../src/lib/matchmaking-server";

if (!process.env.DATABASE_URL || !process.env.APP_ORIGIN) throw new Error("DATABASE_URL and APP_ORIGIN are required");
const origin = new URL(process.env.APP_ORIGIN).origin;
if (origin !== process.env.APP_ORIGIN) throw new Error("APP_ORIGIN must be an exact origin");
const port = Number(process.env.MATCHMAKING_PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid MATCHMAKING_PORT");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10, connectionTimeoutMillis: 5000, statement_timeout: 10_000 });
// Keep a dedicated connection: dropping it stops the process rather than allowing split queues.
const lock = await pool.connect();
lock.on("error", () => { console.error("Matchmaking database lock lost"); process.exit(1); });
const result = await lock.query("SELECT pg_try_advisory_lock(74012026) AS acquired");
if (!result.rows[0].acquired) { lock.release(); await pool.end(); throw new Error("Another matchmaking worker owns this database"); }
const auth = createAuth(pool);
const store = createMatchStore(pool);
const service = createMatchmakingServer({ origin, authenticate: token => auth.current(token), current: store.current, create: store.create });
service.server.listen(port, process.env.MATCHMAKING_HOST ?? "127.0.0.1", () => console.log(`Matchmaking listening on port ${port}`));
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await service.close();
  await lock.query("SELECT pg_advisory_unlock(74012026)");
  lock.release();
  await pool.end();
}
process.on("SIGTERM", () => { void stop(); });
process.on("SIGINT", () => { void stop(); });
