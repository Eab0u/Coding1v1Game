// @vitest-environment node
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import type { Pool } from "pg";
import { expect, it } from "vitest";
import { loadLeaderboard } from "../src/lib/leaderboard";

it("ranks public ratings with shared ranks, stable ties and a top-100 bound", async () => {
  const db = new PGlite();
  try {
    await db.exec(await readFile(new URL("../db/migrations/001_initial.sql", import.meta.url), "utf8"));
    expect(await loadLeaderboard(db as unknown as Pool, "global")).toEqual([]);
    await db.exec(`INSERT INTO users (username,rating,password_hash) VALUES ('Zed',1000.4,'SECRET'),('Ada',1000.4,'SECRET'),('Bob',1000.3,'SECRET');
      INSERT INTO users (username) SELECT 'player_' || n FROM generate_series(1,105) AS n;`);
    const rows = await loadLeaderboard(db as unknown as Pool, "global");
    expect(rows).toHaveLength(100);
    expect(rows.slice(0,3)).toEqual([
      { username: "Ada", rating: 1000.4, score: 1000.4, rank: 1 },
      { username: "Zed", rating: 1000.4, score: 1000.4, rank: 1 },
      { username: "Bob", rating: 1000.3, score: 1000.3, rank: 3 },
    ]);
    expect(JSON.stringify(rows)).not.toContain("SECRET");
    expect(await loadLeaderboard(db as unknown as Pool, "weekly")).toEqual([]);
    await db.exec(`INSERT INTO problems (slug,title,statement,function_signature,difficulty,constraints,reference_solution,brute_force_solution,test_generator,hidden_tests,cpu_limit_ms,memory_limit_kb)
      VALUES ('test','Test','test','def solve():','easy','test','secret','secret','secret','[]',1000,65536);`);
    // Boundary at Monday UTC is inclusive; prior week, future and cancelled matches do not count.
    for (const [time, status, gain] of [
      ["date_trunc('week', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'", "completed", 10],
      ["now()", "completed", -3],
      ["(date_trunc('week', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') - interval '1 microsecond'", "completed", 900],
      ["now() + interval '1 day'", "completed", 900],
      ["now()", "cancelled", 900],
    ] as const) {
      const match = await db.query<{id:string}>(`INSERT INTO matches (problem_id,player_one_id,player_two_id,status,completed_at)
        SELECT p.id,a.id,b.id,$1,${time} FROM problems p,users a,users b WHERE a.username='Ada' AND b.username='Bob' RETURNING id`, [status]);
      await db.query(`INSERT INTO rating_history (user_id,match_id,rating_before,rating_after)
        SELECT id,$1,800,800+$2 FROM users WHERE username='Ada'`, [match.rows[0].id,gain]);
    }
    expect(await loadLeaderboard(db as unknown as Pool, "weekly")).toEqual([{username:"Ada",rating:1000.4,score:7,rank:1}]);
  } finally { await db.close(); }
}, 30000);
