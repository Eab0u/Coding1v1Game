import type { Pool } from "pg";

export type LeaderboardPeriod = "global" | "weekly";
export interface LeaderboardEntry { username: string; rating: number; score: number; rank: number }

/** Public projection only. Weekly gains use completed duels since Monday 00:00 UTC. */
export async function loadLeaderboard(db: Pick<Pool, "query">, period: LeaderboardPeriod): Promise<LeaderboardEntry[]> {
  const result = await db.query<LeaderboardEntry>(period === "weekly" ? `
    WITH gains AS (
      SELECT h.user_id, sum(h.rating_after-h.rating_before) AS score
      FROM rating_history h JOIN matches m ON m.id=h.match_id
      WHERE m.status='completed' AND m.completed_at >= date_trunc('week', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
        AND m.completed_at <= now()
      GROUP BY h.user_id
    )
    SELECT u.username, u.rating, g.score,
      (rank() OVER (ORDER BY g.score DESC))::integer AS rank
    FROM gains g JOIN users u ON u.id=g.user_id
    ORDER BY g.score DESC, lower(u.username), u.id LIMIT 100
  ` : `SELECT username, rating, rating AS score,
    (rank() OVER (ORDER BY rating DESC))::integer AS rank
    FROM users ORDER BY rating DESC, lower(username), id LIMIT 100`);
  return result.rows;
}
