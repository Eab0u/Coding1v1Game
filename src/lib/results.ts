import type { Pool } from "pg";

export interface DuelResult {
  title: string;
  outcome: "WIN" | "LOSS" | "DRAW";
  players: { username: string; before: number | null; after: number | null; passed: number | null; total: number | null; cpu: number | null; submitted: number | null }[];
}

/** Only completed participant results, never solutions or individual hidden tests. */
export async function loadResult(db: Pick<Pool, "query">, id: string, userId: string): Promise<DuelResult | null> {
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) return null;
  const { rows } = await db.query(`SELECT p.title,
    CASE WHEN m.winner_id=$2 THEN 'WIN' WHEN m.winner_id IS NULL THEN 'DRAW' ELSE 'LOSS' END AS outcome,
    u.username,h.rating_before AS before,h.rating_after AS after,
    r.tests_passed AS passed,r.tests_total AS total,r.median_cpu_ms AS cpu,r.submitted_after_ms AS submitted
    FROM matches m JOIN problems p ON p.id=m.problem_id
    JOIN users u ON u.id IN (m.player_one_id,m.player_two_id)
    LEFT JOIN rating_history h ON h.match_id=m.id AND h.user_id=u.id
    LEFT JOIN match_results r ON r.match_id=m.id AND r.user_id=u.id
    WHERE m.id=$1 AND $2 IN (m.player_one_id,m.player_two_id)
      AND m.status='completed' AND m.completed_at<=now()
    ORDER BY CASE WHEN u.id=$2 THEN 0 ELSE 1 END`, [id,userId]);
  if (rows.length !== 2) return null;
  return {title:rows[0].title,outcome:rows[0].outcome,players:rows.map(r=>({username:r.username,before:r.before,after:r.after,passed:r.passed,total:r.total,cpu:r.cpu,submitted:r.submitted}))};
}
