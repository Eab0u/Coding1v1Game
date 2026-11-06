import "server-only";
import { Pool } from "pg";
import { createAuth } from "./auth";

const globalDb = globalThis as typeof globalThis & { authPool?: Pool };
export function database() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  return globalDb.authPool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
}
export const auth = createAuth({ query: <T extends Record<string, unknown>>(sql: string, params?: unknown[]) => database().query<T>(sql, params) });

