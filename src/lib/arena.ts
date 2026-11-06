import type { Pool } from "pg";

export interface ArenaSnapshot {
  id: string; status: string; deadline: string | null; serverTime: string;
  player: { username: string; rating: number }; opponent: { username: string; rating: number };
  problem: { title: string; statement: string; signature: string; difficulty: string; constraints: string; examples: unknown };
  progress: { passed: number; total: number } | null;
  submission?: { status: string; passed: number | null; total: number | null } | null;
}

/** Explicit projection: neither source code nor private problem fields leave this boundary. */
export async function loadArena(db: Pick<Pool, "query">, id: string, userId: string): Promise<ArenaSnapshot | null> {
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) return null;
  const result = await db.query(`SELECT m.id,m.status,m.deadline_at,now() AS server_time,
    a.username,a.rating,b.username AS opponent,b.rating AS opponent_rating,
    p.title,p.statement,p.function_signature,p.difficulty,p.constraints,p.examples,
    s.tests_passed,s.tests_total,own.status AS own_status,own.tests_passed AS own_passed,own.tests_total AS own_total
    FROM matches m JOIN problems p ON p.id=m.problem_id
    JOIN users a ON a.id=$2
    JOIN users b ON b.id=CASE WHEN m.player_one_id=$2 THEN m.player_two_id ELSE m.player_one_id END
    LEFT JOIN LATERAL (SELECT tests_passed,tests_total FROM submissions
      WHERE match_id=m.id AND user_id=b.id AND status='judged'
      ORDER BY submitted_at DESC,id DESC LIMIT 1) s ON true
    LEFT JOIN LATERAL (SELECT status,tests_passed,tests_total FROM submissions
      WHERE match_id=m.id AND user_id=$2 ORDER BY submitted_at DESC,id DESC LIMIT 1) own ON true
    WHERE m.id=$1 AND (m.player_one_id=$2 OR m.player_two_id=$2)`, [id,userId]);
  const r = result.rows[0];
  if (!r) return null;
  return { id:r.id,status:r.status,deadline:r.deadline_at?.toISOString() ?? null,serverTime:r.server_time.toISOString(),
    player:{username:r.username,rating:r.rating},opponent:{username:r.opponent,rating:r.opponent_rating},
    problem:{title:r.title,statement:r.statement,signature:r.function_signature,difficulty:r.difficulty,constraints:r.constraints,examples:r.examples},
    progress:r.tests_passed == null || r.tests_total == null ? null : {passed:r.tests_passed,total:r.tests_total},
    submission:r.own_status ? {status:r.own_status,passed:r.own_passed,total:r.own_total} : null };
}
