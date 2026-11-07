// @vitest-environment node
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, describe, expect, it } from "vitest";

const db = new PGlite();
beforeAll(async () => {
  await db.exec(await readFile(new URL("../db/migrations/001_initial.sql", import.meta.url), "utf8"));
}, 30000);
afterAll(async () => { await db.close(); });

describe("Postgres schema", () => {
  it("starts new players at 800 with Glicko-2 defaults", async () => {
    const result = await db.query("INSERT INTO users (username) VALUES ('schema_player') RETURNING rating, rating_deviation, volatility");
    expect(result.rows[0]).toEqual({ rating: 800, rating_deviation: 350, volatility: 0.06 });
  });

  it("rejects duplicate or invalid usernames", async () => {
    await db.query("INSERT INTO users (username) VALUES ('unique_player')");
    await expect(db.query("INSERT INTO users (username) VALUES ('unique_player')")).rejects.toThrow();
    await expect(db.query("INSERT INTO users (username) VALUES ('!')")).rejects.toThrow();
  });

  it("supports a complete match, submission and rating history", async () => {
    const players = await db.query<{ id: string }>("INSERT INTO users (username) VALUES ('player_one'), ('player_two') RETURNING id");
    const [one, two] = players.rows.map((row) => row.id);
    const problem = await db.query<{ id: string }>(`INSERT INTO problems
      (slug, title, statement, function_signature, difficulty, constraints, reference_solution, brute_force_solution, test_generator, hidden_tests, cpu_limit_ms, memory_limit_kb)
      VALUES ('fixture', 'Fixture', 'Test fixture', 'def solve():', 'easy', 'n <= 10', 'pass', 'pass', 'pass', '[]', 1000, 65536) RETURNING id`);
    const problemId = problem.rows[0].id;
    await expect(db.query("INSERT INTO matches (problem_id, player_one_id, player_two_id) VALUES ($1,$2,$2)", [problemId, one])).rejects.toThrow();
    const match = await db.query<{ id: string }>("INSERT INTO matches (problem_id, player_one_id, player_two_id) VALUES ($1,$2,$3) RETURNING id", [problemId, one, two]);
    const matchId = match.rows[0].id;
    await expect(db.query("INSERT INTO submissions (match_id, user_id, source_code, tests_passed, tests_total) VALUES ($1,$2,'pass',3,2)", [matchId, one])).rejects.toThrow();
    await db.query("INSERT INTO submissions (match_id, user_id, source_code, status, tests_passed, tests_total, largest_test_cpu_ms) VALUES ($1,$2,'pass','judged',2,2,1.5)", [matchId, one]);
    await db.query("UPDATE matches SET status='completed', winner_id=$2, completed_at=now() WHERE id=$1", [matchId, one]);
    await db.query("INSERT INTO rating_history (user_id, match_id, rating_before, rating_after) VALUES ($1,$2,800,816)", [one, matchId]);
    await expect(db.query("INSERT INTO rating_history (user_id, match_id, rating_before, rating_after) VALUES ($1,$2,800,816)", [one, matchId])).rejects.toThrow();
    const result = await db.query("SELECT status, winner_id FROM matches WHERE id=$1", [matchId]);
    expect(result.rows[0]).toEqual({ status: "completed", winner_id: one });
  });
});
