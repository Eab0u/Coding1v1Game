import type { Pool, PoolClient } from "pg";

/** Shared transaction wrapper: BEGIN, run fn, COMMIT; ROLLBACK and rethrow on failure; always release. */
export async function transaction<T>(pool: Pool, fn: (db: PoolClient) => Promise<T>): Promise<T> {
  const db = await pool.connect();
  try { await db.query("BEGIN"); const value = await fn(db); await db.query("COMMIT"); return value; }
  catch (error) { await db.query("ROLLBACK"); throw error; }
  finally { db.release(); }
}
