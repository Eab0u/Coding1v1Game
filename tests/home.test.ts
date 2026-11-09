// @vitest-environment node
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import type { Pool } from "pg";
import { expect, it } from "vitest";
import { loadHome } from "../src/lib/home";
it("counts the current streak, excludes unfinished matches and keeps private problem fields private", async () => {
  const db = new PGlite();
  try {
    await db.exec(await readFile(new URL("../db/migrations/001_initial.sql", import.meta.url), "utf8"));
    const users = await db.query<{ id: string }>("INSERT INTO users (username) VALUES ('one'),('two') RETURNING id");
    const [one, two] = users.rows.map(row => row.id);
    const problems = await db.query<{ id: string }>(`INSERT INTO problems (slug,title,statement,function_signature,difficulty,constraints,reference_solution,brute_force_solution,test_generator,hidden_tests,cpu_limit_ms,memory_limit_kb,published_at)
      VALUES ('public','Public','statement','def solve():','easy','n<10','SECRET','SECRET','SECRET','[]',1000,65536,now()),
      ('draft','Draft','statement','def solve():','easy','n<10','SECRET','SECRET','SECRET','[]',1000,65536,null) RETURNING id`);
    for (let i = 0; i < 8; i++) {
      await db.query(`INSERT INTO matches (problem_id,player_one_id,player_two_id,status,winner_id,completed_at)
        VALUES ($1,$2,$3,'completed',$4,now() + ($5::integer * interval '1 second'))`, [problems.rows[0].id, one, two, i < 2 ? null : one, i]);
    }
    const examples = [{ args: [[1, 2]], expected: 3, explanation: "Add both readings." }];
    await db.query("UPDATE problems SET topics=ARRAY['arrays','greedy'], examples=$1::jsonb WHERE id=$2", [JSON.stringify(examples), problems.rows[0].id]);
    const data = await loadHome(db as unknown as Pool, one);
    expect(data.streak).toBe(6);
    expect(data.recent).toHaveLength(5);
    expect(data.recent.every(row => row.delta === null)).toBe(true);
    const matchId = data.recent[0].id;
    await db.query(`INSERT INTO rating_history (user_id,match_id,rating_before,rating_after) VALUES
      ($1,$3,800,812.6),($2,$3,800,777)`, [one, two, matchId]);
    const personal = await loadHome(db as unknown as Pool, one);
    expect(personal.recent[0].delta).toBeCloseTo(12.6);
    expect(personal.recent).toHaveLength(5);
    const opponent = await loadHome(db as unknown as Pool, two);
    expect(opponent.recent[0].delta).toBe(-23);
    expect(personal.recent[1].delta).toBeNull();
    expect(data.daily?.title).toBe("Public");
    expect(data.daily?.examples).toEqual(examples);
    expect(data.daily?.topics).toEqual(["arrays", "greedy"]);
    expect(data.daily?.constraints).toBe("n<10");
    expect(Object.keys(data.daily!).sort()).toEqual(["constraints", "difficulty", "examples", "function_signature", "statement", "title", "topics"]);
    expect(JSON.stringify(data)).not.toContain("SECRET");
    const guest = await loadHome(db as unknown as Pool);
    expect(guest.recent).toEqual([]);
    expect(guest.daily).toEqual(data.daily);
    await db.query(`INSERT INTO matches (problem_id,player_one_id,player_two_id,status,completed_at)
      VALUES ($1,$2,$3,'completed',now() + interval '1 hour')`, [problems.rows[0].id, one, two]);
    expect((await loadHome(db as unknown as Pool, one)).streak).toBe(0);
  } finally { await db.close(); }
}, 30000);
