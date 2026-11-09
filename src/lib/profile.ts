import type { Pool } from "pg";

export const RATING_TIERS = [
  { name: "Bronze", minimum: 0 },
  { name: "Silver", minimum: 1000 },
  { name: "Gold", minimum: 1200 },
  { name: "Platinum", minimum: 1600 },
  { name: "Diamond", minimum: 2000 },
  { name: "Master", minimum: 2400 },
] as const;

export function ratingTier(rating: number): string {
  return RATING_TIERS.findLast(tier => rating >= tier.minimum)?.name ?? "Bronze";
}

/** Public fields only; unfinished matches never contribute to records or graphs. */
export async function loadProfile(db: Pick<Pool, "query">, username: string) {
  const users = await db.query<{ id: string; username: string; rating: number }>(
    "SELECT id, username, rating FROM users WHERE lower(username)=lower($1)", [username]);
  const user = users.rows[0];
  if (!user) return null;
  const record = await db.query<{ wins: number; losses: number; draws: number }>(`SELECT
    count(*) FILTER (WHERE winner_id=$1)::integer AS wins,
    count(*) FILTER (WHERE winner_id IS NOT NULL AND winner_id<>$1)::integer AS losses,
    count(*) FILTER (WHERE winner_id IS NULL)::integer AS draws
    FROM matches WHERE (player_one_id=$1 OR player_two_id=$1) AND status='completed' AND completed_at<=now()`, [user.id]);
  const history = await db.query<{ id: string; title: string; opponent: string; result: string; completed_at: Date; delta: number | null }>(`SELECT m.id, p.title, u.username AS opponent, m.completed_at,
    CASE WHEN m.winner_id=$1 THEN 'WIN' WHEN m.winner_id IS NULL THEN 'DRAW' ELSE 'LOSS' END AS result,
    h.rating_after-h.rating_before AS delta
    FROM matches m JOIN problems p ON p.id=m.problem_id
    JOIN users u ON u.id=CASE WHEN m.player_one_id=$1 THEN m.player_two_id ELSE m.player_one_id END
    LEFT JOIN rating_history h ON h.match_id=m.id AND h.user_id=$1
    WHERE (m.player_one_id=$1 OR m.player_two_id=$1) AND m.status='completed' AND m.completed_at<=now()
    ORDER BY m.completed_at DESC, m.id DESC LIMIT 20`, [user.id]);
  const ratings = await db.query<{ rating_before: number; rating_after: number; completed_at: Date }>(`SELECT h.rating_before, h.rating_after, m.completed_at
    FROM rating_history h JOIN matches m ON m.id=h.match_id
    WHERE h.user_id=$1 AND (m.player_one_id=$1 OR m.player_two_id=$1) AND m.status='completed' AND m.completed_at<=now()
    ORDER BY m.completed_at DESC, m.id DESC LIMIT 50`, [user.id]);
  return { username: user.username, rating: user.rating, record: record.rows[0], history: history.rows, ratings: ratings.rows.reverse() };
}
