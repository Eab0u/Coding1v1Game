// @vitest-environment node
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import type { Pool } from "pg";
import { beforeAll, afterAll, expect, it } from "vitest";
import { createMatchStore } from "../src/lib/matchmaking-store";
import type { Account } from "../src/lib/auth";
const db = new PGlite();
const store = createMatchStore({ query: db.query.bind(db), connect: async () => ({ query: db.query.bind(db), release() {} }) } as unknown as Pool);
let one: Account, two: Account;
beforeAll(async () => {
  await db.exec(await readFile(new URL("../db/migrations/001_initial.sql", import.meta.url), "utf8"));
  const users = await db.query<Account>("INSERT INTO users (username) VALUES ('one'),('two') RETURNING id,username,rating");
  [one, two] = users.rows;
  await db.query(`INSERT INTO problems (slug,title,statement,function_signature,difficulty,constraints,reference_solution,brute_force_solution,test_generator,hidden_tests,cpu_limit_ms,memory_limit_kb)
    VALUES ('fixture','Fixture','statement','def solve():','easy','n<10','SECRET','SECRET','SECRET','[]',1000,65536)`);
}, 30000);
afterAll(async () => { await db.close(); });
it("requires a published problem and rolls back cleanly", async () => {
  await expect(store.create(one, two, "easy")).rejects.toThrow("No published");
  expect(await store.current(one.id)).toBeNull();
  await db.query("UPDATE problems SET published_at=now() + interval '1 day'");
  await expect(store.create(one, two, "easy")).rejects.toThrow("No published");
  await db.query("UPDATE problems SET published_at=now()");
  await expect(store.create(one, two, "hard")).rejects.toThrow("No published");
});
it("persists pending matches, recovers both sides and prevents unfinished duplicates", async () => {
  const match = await store.create(one, two, "easy");
  expect(await store.current(one.id)).toEqual({ ...match, opponent: two });
  expect(await store.current(two.id)).toEqual({ ...match, opponent: one });
  await expect(store.create(two, one, "easy")).rejects.toThrow("already in match");
  await db.query("UPDATE matches SET status='active' WHERE id=$1", [match.id]);
  await expect(store.create(one, two, "easy")).rejects.toThrow("already in match");
  await db.query("UPDATE matches SET status='cancelled' WHERE id=$1", [match.id]);
  expect(await store.current(one.id)).toBeNull();
  const next = await store.create(two, one, "easy"); expect(next.id).not.toBe(match.id);
  expect(JSON.stringify(await store.current(one.id))).not.toContain("SECRET");
});
