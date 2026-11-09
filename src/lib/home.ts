import type { Pool } from "pg";

export async function loadHome(db: Pick<Pool, "query">, userId?: string) {
  const dailyQuery = db.query(`SELECT title, difficulty, statement, function_signature, constraints, examples, topics FROM problems
    WHERE published_at <= now() ORDER BY md5(slug || (now() AT TIME ZONE 'UTC')::date::text), id LIMIT 1`);
  if (!userId) { const daily = await dailyQuery; return { daily: daily.rows[0] ?? null, recent: [], streak: 0 }; }
  const [daily, recent, streak] = await Promise.all([
    dailyQuery,
    db.query(`SELECT m.id, p.title, m.winner_id, m.completed_at, u.username AS opponent,
      h.rating_after-h.rating_before AS delta
      FROM matches m JOIN problems p ON p.id=m.problem_id
      JOIN users u ON u.id=CASE WHEN m.player_one_id=$1 THEN m.player_two_id ELSE m.player_one_id END
      LEFT JOIN rating_history h ON h.match_id=m.id AND h.user_id=$1
      WHERE (m.player_one_id=$1 OR m.player_two_id=$1) AND m.status='completed'
      ORDER BY m.completed_at DESC, m.id DESC LIMIT 5`, [userId]),
    db.query(`WITH history AS (
      SELECT winner_id, row_number() OVER (ORDER BY completed_at DESC, id DESC) AS position
      FROM matches WHERE (player_one_id=$1 OR player_two_id=$1) AND status='completed')
      SELECT count(*)::integer AS wins FROM history WHERE winner_id=$1 AND position <
      COALESCE((SELECT min(position) FROM history WHERE winner_id IS DISTINCT FROM $1::uuid), 9223372036854775807)`, [userId]),
  ]);
  return { daily: daily.rows[0] ?? null, recent: recent.rows, streak: streak.rows[0].wins as number };
}
