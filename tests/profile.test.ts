// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import type { Pool } from 'pg';
import { expect, it } from 'vitest';
import { loadProfile, ratingTier } from '../src/lib/profile';

it('loads public profiles, full records and bounded chronological ratings from completed matches only', async () => {
  const db = new PGlite();
  try {
    await db.exec(await readFile(new URL('../db/migrations/001_initial.sql', import.meta.url), 'utf8'));
    const store = db as unknown as Pool;
    expect(await loadProfile(store, 'missing')).toBeNull();
    await db.exec(`INSERT INTO users (username,password_hash) VALUES ('Ada','SECRET'),('Bob','SECRET'),('Eve','SECRET');
      INSERT INTO problems (slug,title,statement,function_signature,difficulty,constraints,reference_solution,brute_force_solution,test_generator,hidden_tests,cpu_limit_ms,memory_limit_kb)
      VALUES ('test','Test','test','def solve():','easy','test','SECRET','SECRET','SECRET','[]',1000,65536);`);
    const empty = await loadProfile(store, 'aDA');
    expect(empty).toMatchObject({username:'Ada', record:{wins:0,losses:0,draws:0}, history:[], ratings:[]});
    for (let i = 0; i < 55; i++) {
      const match = await db.query<{id:string}>(`INSERT INTO matches (problem_id,player_one_id,player_two_id,status,completed_at,winner_id)
        SELECT p.id,a.id,b.id,'completed',now()-($1 * interval '1 minute'),CASE WHEN $1::integer % 3=0 THEN a.id WHEN $1::integer % 3=1 THEN b.id ELSE NULL END
        FROM problems p,users a,users b WHERE a.username='Ada' AND b.username='Bob' RETURNING id`, [i]);
      await db.query(`INSERT INTO rating_history (user_id,match_id,rating_before,rating_after) SELECT id,$1,$2::double precision,$2::double precision+1 FROM users WHERE username='Ada'`, [match.rows[0].id, 900-i]);
    }
    await db.exec(`INSERT INTO matches (problem_id,player_one_id,player_two_id,status,completed_at) SELECT p.id,a.id,b.id,'cancelled',now() FROM problems p,users a,users b WHERE a.username='Ada' AND b.username='Bob';
      INSERT INTO matches (problem_id,player_one_id,player_two_id,status,completed_at) SELECT p.id,a.id,b.id,'completed',now()+interval '1 day' FROM problems p,users a,users b WHERE a.username='Ada' AND b.username='Bob';`);
    const data = await loadProfile(store, 'Ada');
    expect(data?.record).toEqual({wins:19,losses:18,draws:18});
    expect(data?.history).toHaveLength(20);
    expect(data?.history[0]).toMatchObject({opponent:'Bob',result:'WIN',delta:1});
    expect(data?.ratings).toHaveLength(50);
    expect(data?.ratings[0].rating_before).toBe(851);
    expect(data?.ratings.at(-1)?.rating_after).toBe(901);
    expect(JSON.stringify(data)).not.toContain('SECRET');
    expect((await loadProfile(store, 'Eve'))?.record).toEqual({wins:0,losses:0,draws:0});
    expect(await loadProfile(store, "Ada' OR true--")).toBeNull();
  } finally { await db.close(); }
}, 30000);
it('assigns tiers at exact boundaries', () => {
  expect([0,999,1000,1199,1200,1599,1600,1999,2000,2399,2400].map(ratingTier)).toEqual(['Bronze','Bronze','Silver','Silver','Gold','Gold','Platinum','Platinum','Diamond','Diamond','Master']);
});


