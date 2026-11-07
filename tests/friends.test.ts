// @vitest-environment node
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import type { Pool } from "pg";
import { expect, it } from "vitest";
import { changeFriend, loadFriends } from "../src/lib/friends";
import { loadLeaderboard } from "../src/lib/leaderboard";

it("enforces consent, unique pairs, participant removal and friends-only ranking", async () => {
  const db = new PGlite();
  try {
    for (const file of ["001_initial.sql", "003_friends.sql"]) await db.exec(await readFile(new URL(`../db/migrations/${file}`, import.meta.url), "utf8"));
    const users = await db.query<{id:string}>(`INSERT INTO users (username,rating) VALUES ('Ada',900),('Bob',1000),('Eve',1200) RETURNING id`);
    const [ada,bob,eve] = users.rows.map(row => row.id);
    await changeFriend(db, ada, "request", "bOB");
    await changeFriend(db, bob, "request", "Ada");
    expect(await loadFriends(db, bob)).toEqual([{username:"Ada",status:"pending",incoming:true}]);
    await changeFriend(db, ada, "accept", "Bob");
    await changeFriend(db, eve, "accept", "Bob");
    await changeFriend(db, eve, "remove", "Bob");
    expect((await loadFriends(db, ada))[0].status).toBe("pending");
    const sql = db as unknown as Pool;
    expect((await loadLeaderboard(sql,"global",ada)).map(row => row.username)).toEqual(["Ada"]);
    await changeFriend(db, bob, "accept", "Ada");
    expect(await loadLeaderboard(sql,"global",ada)).toEqual([
      {username:"Bob",rating:1000,score:1000,rank:1}, {username:"Ada",rating:900,score:900,rank:2},
    ]);
    expect(await loadLeaderboard(sql,"weekly",ada)).toEqual([]);
    await changeFriend(db, ada, "request", "Ada");
    await changeFriend(db, ada, "request", "Missing");
    expect(await loadFriends(db, ada)).toHaveLength(1);
    await expect(changeFriend(db, ada, "request", "' OR 1=1")).rejects.toThrow();
    await changeFriend(db, bob, "remove", "Ada");
    expect(await loadFriends(db, ada)).toEqual([]);
    await changeFriend(db, ada, "request", "Bob");
    await changeFriend(db, bob, "remove", "Ada");
    expect(await loadFriends(db, ada)).toEqual([]);
  } finally { await db.close(); }
}, 30000);
