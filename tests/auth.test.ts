// @vitest-environment node
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, expect, it } from "vitest";
import { createAuth, credentials, hashPassword, verifyPassword } from "../src/lib/auth";
const db = new PGlite();
const auth = createAuth(db);
beforeAll(async () => {
  for (const name of ["001_initial.sql", "002_auth.sql"]) await db.exec(await readFile(new URL(`../db/migrations/${name}`, import.meta.url), "utf8"));
}, 30000);
afterAll(async () => { await db.close(); });
it("salts password hashes and rejects wrong passwords and corrupt hashes", async () => {
  const a = await hashPassword("a long password!");
  expect(a).not.toContain("a long password!");
  expect(await hashPassword("a long password!")).not.toBe(a);
  expect(await verifyPassword("a long password!", a)).toBe(true);
  expect(await verifyPassword("wrong password!", a)).toBe(false);
  expect(await verifyPassword("a long password!", null)).toBe(false);
  expect(await verifyPassword("a long password!", "bad")).toBe(false);
});
it.each([["!", "long enough password"], ["ab", "long enough password"], ["valid", "short"], ["valid", "x".repeat(257)], ["valid", "\u{1F600}".repeat(65)], [null, "long enough password"], ["valid", null]])("rejects invalid credentials %s", (username, password) => {
  expect(() => credentials(username, password)).toThrow();
});
it("registers at 800, stores only a token digest, logs in case insensitively and rotates sessions", async () => {
  const first = await auth.authenticate("signup", "Duelist", "a long password!");
  expect(first.user.rating).toBe(800);
  expect(await auth.current(first.token)).toEqual(first.user);
  const sessions = await db.query<{ token_hash: string }>("SELECT token_hash FROM auth_sessions");
  expect(sessions.rows[0].token_hash).not.toBe(first.token);
  await expect(auth.authenticate("signup", "duelist", "a long password!")).rejects.toThrow("unavailable");
  await expect(auth.authenticate("login", "Duelist", "incorrect password")).rejects.toThrow("Incorrect username or password");
  await expect(auth.authenticate("login", "missing", "incorrect password")).rejects.toThrow("Incorrect username or password");
  const second = await auth.authenticate("login", "DUELIST", "a long password!", first.token);
  expect(await auth.current(first.token)).toBeNull();
  expect(await auth.current(second.token)).toEqual(first.user);
  expect(second.user).not.toHaveProperty("password_hash");
  await auth.logout(second.token);
  expect(await auth.current(second.token)).toBeNull();
});
it("rejects forged, missing and expired sessions", async () => {
  expect(await auth.current()).toBeNull();
  expect(await auth.current("' OR 1=1")).toBeNull();
  expect(await auth.current("a".repeat(64))).toBeNull();
  const session = await auth.authenticate("signup", "expired", "a long password!");
  await db.query("UPDATE auth_sessions SET expires_at=now() - interval '1 second'");
  expect(await auth.current(session.token)).toBeNull();
});
it("persists throttling across service instances and resets after the window", async () => {
  for (let i = 0; i < 10; i++) await expect(auth.authenticate("login", "limited", "a long password!")).rejects.toThrow("Incorrect");
  await expect(createAuth(db).authenticate("login", "LIMITED", "a long password!")).rejects.toThrow("Too many attempts");
  await db.query("UPDATE auth_attempts SET window_start=now() - interval '16 minutes' WHERE username='limited'");
  await expect(auth.authenticate("login", "limited", "a long password!")).rejects.toThrow("Incorrect");
});

