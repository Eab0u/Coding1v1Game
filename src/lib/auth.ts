import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

import { passwordValidationMessage } from "./password-validation";
import { usernameValidationMessage, USERNAME_HINT } from "./username-validation";

export interface AuthDatabase {
  query<T extends Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}
export type Account = { id: string; username: string; rating: number };
export class AuthError extends Error {}
export const SESSION_SECONDS = 60 * 60 * 24 * 7;
export const SESSION_COOKIE = "codeduel_session";
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
const derive = (password: string, salt: string) => new Promise<Buffer>((resolve, reject) => {
  scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key));
});
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${(await derive(password, salt)).toString("hex")}`;
}
export async function verifyPassword(password: string, stored: string | null) {
  const valid = /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(stored ?? "");
  const [, salt, expected] = valid ? stored!.split("$") : ["", "0".repeat(32), "0".repeat(128)];
  const actual = await derive(password, salt);
  return timingSafeEqual(actual, Buffer.from(expected, "hex")) && valid;
}
export function credentials(username: unknown, password: unknown) {
  if (typeof username !== "string" || usernameValidationMessage(username)) throw new AuthError(USERNAME_HINT);
  if (typeof password !== "string" || passwordValidationMessage(password)) throw new AuthError("Use a password of at least 12 characters and at most 256 bytes.");
  return { username, password };
}
export function createAuth(db: AuthDatabase) {
  return {
    async authenticate(mode: "signup" | "login", username: unknown, password: unknown, oldToken?: string) {
      const input = credentials(username, password);
      const attempt = await db.query<{ attempts: number }>(`INSERT INTO auth_attempts (username) VALUES (lower($1))
        ON CONFLICT (username) DO UPDATE SET
        attempts = CASE WHEN auth_attempts.window_start <= now() - interval '15 minutes' THEN 1 ELSE auth_attempts.attempts + 1 END,
        window_start = CASE WHEN auth_attempts.window_start <= now() - interval '15 minutes' THEN now() ELSE auth_attempts.window_start END
        RETURNING attempts`, [input.username]);
      if (attempt.rows[0].attempts > 10) throw new AuthError("Too many attempts. Try again in 15 minutes.");
      let user: Account;
      if (mode === "signup") {
        const hash = await hashPassword(input.password);
        const result = await db.query<Account>(`INSERT INTO users (username, password_hash) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING id, username, rating`, [input.username, hash]);
        if (!result.rows[0]) throw new AuthError("That username is unavailable.");
        user = result.rows[0];
      } else {
        const result = await db.query<Account & { password_hash: string | null }>("SELECT id, username, rating, password_hash FROM users WHERE lower(username)=lower($1)", [input.username]);
        const row = result.rows[0];
        if (!await verifyPassword(input.password, row?.password_hash ?? null) || !row) throw new AuthError("Incorrect username or password.");
        user = { id: row.id, username: row.username, rating: row.rating };
      }
      const token = randomBytes(32).toString("hex");
      await db.query("INSERT INTO auth_sessions (token_hash,user_id,expires_at) VALUES ($1,$2,now() + interval '7 days')", [tokenHash(token), user.id]);
      if (oldToken) await this.logout(oldToken);
      return { user, token };
    },
    async current(token?: string): Promise<Account | null> {
      if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
      const result = await db.query<Account>(`SELECT u.id,u.username,u.rating FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at > now()`, [tokenHash(token)]);
      return result.rows[0] ?? null;
    },
    async logout(token?: string) {
      if (token) await db.query("DELETE FROM auth_sessions WHERE token_hash=$1", [tokenHash(token)]);
    },
  };
}


