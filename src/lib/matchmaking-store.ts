import type { Pool } from "pg";
import type { Account } from "./auth";
import type { Difficulty, MatchTicket } from "./matchmaking";

export function createMatchStore(pool: Pool) {
  return {
    async current(userId: string): Promise<(MatchTicket & { opponent: Account }) | null> {
      const result = await pool.query(`SELECT m.id, p.difficulty, u.id AS opponent_id, u.username, u.rating
        FROM matches m JOIN problems p ON p.id=m.problem_id
        JOIN users u ON u.id=CASE WHEN m.player_one_id=$1 THEN m.player_two_id ELSE m.player_one_id END
        WHERE (m.player_one_id=$1 OR m.player_two_id=$1) AND m.status IN ('pending','active')
        ORDER BY m.created_at DESC LIMIT 1`, [userId]);
      const row = result.rows[0];
      return row ? { id: row.id, difficulty: row.difficulty, opponent: { id: row.opponent_id, username: row.username, rating: row.rating } } : null;
    },
    async create(one: Account, two: Account, difficulty: Difficulty): Promise<MatchTicket> {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        // Lock both players in a stable order, then check their unfinished matches.
        await client.query("SELECT id FROM users WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE", [[one.id, two.id]]);
        const busy = await client.query("SELECT id FROM matches WHERE status IN ('pending','active') AND (player_one_id=ANY($1::uuid[]) OR player_two_id=ANY($1::uuid[]))", [[one.id, two.id]]);
        if (busy.rows.length) throw new Error("Player already in match");
        // Prefer unseen challenges for both players, then the least recently
        // exposed. Cancelled reservations count too, preventing reroll fishing.
        const problem = await client.query(`SELECT p.id FROM problems p
          LEFT JOIN LATERAL (
            SELECT max(m.created_at) AS last_seen FROM matches m
            WHERE m.problem_id=p.id AND
              (m.player_one_id=ANY($2::uuid[]) OR m.player_two_id=ANY($2::uuid[]))
          ) history ON true
          WHERE p.published_at <= now() AND p.difficulty=$1
          ORDER BY history.last_seen ASC NULLS FIRST, random() LIMIT 1`, [difficulty, [one.id, two.id]]);
        if (!problem.rows[0]) throw new Error("No published problem");
        const result = await client.query("INSERT INTO matches (problem_id,player_one_id,player_two_id) VALUES ($1,$2,$3) RETURNING id", [problem.rows[0].id, one.id, two.id]);
        await client.query("COMMIT");
        return { id: result.rows[0].id, difficulty };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally { client.release(); }
    },
  };
}
