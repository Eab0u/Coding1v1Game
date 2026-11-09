// @vitest-environment node
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import type { Pool } from "pg";
import { expect, it } from "vitest";
import { loadResult } from "../src/lib/results";
it("restricts completed results to participants and returns final scores without secrets",async()=>{
  const db=new PGlite();
  try {
    await db.exec(await readFile(new URL('../db/migrations/001_initial.sql',import.meta.url),'utf8'));
    await db.exec(`INSERT INTO users(username,password_hash) VALUES ('Ada','SECRET'),('Bob','SECRET'),('Eve','SECRET');
      INSERT INTO problems(slug,title,statement,function_signature,difficulty,constraints,reference_solution,brute_force_solution,test_generator,hidden_tests,cpu_limit_ms,memory_limit_kb)
      VALUES ('sample','Sample','Statement','def solve():','easy','Constraints','SECRET','SECRET','SECRET','[]',1000,65536);
      INSERT INTO matches(problem_id,player_one_id,player_two_id) SELECT p.id,a.id,b.id FROM problems p,users a,users b WHERE a.username='Ada' AND b.username='Bob';`);
    const {rows:[m]}=await db.query<{id:string}>("SELECT id FROM matches");
    const {rows:users}=await db.query<{id:string;username:string}>("SELECT id,username FROM users ORDER BY username");
    const store=db as unknown as Pool;
    await db.exec(await readFile(new URL('../db/migrations/004_match_results.sql',import.meta.url),'utf8'));
    expect(await loadResult(store,m.id,users[0].id)).toBeNull();
    expect(await loadResult(store,"invalid",users[0].id)).toBeNull();
    await db.query("UPDATE matches SET status='completed',completed_at='2026-01-02T03:04:00Z',winner_id=$2 WHERE id=$1",[m.id,users[0].id]);
    expect(await loadResult(store,m.id,users[2].id)).toBeNull();
    expect(await loadResult(store,m.id,users[0].id)).toMatchObject({outcome:'WIN',players:[{username:'Ada',passed:null,before:null},{username:'Bob'}]});
    await db.query(`INSERT INTO match_results VALUES ($1,$2,8,8,12.5,1500),($1,$3,4,8,90,NULL)`,[m.id,users[0].id,users[1].id]);
    await db.query(`INSERT INTO rating_history(user_id,match_id,rating_before,rating_after) VALUES ($2,$1,800,808),($3,$1,800,792)`,[m.id,users[0].id,users[1].id]);
    const result=await loadResult(store,m.id,users[1].id);
    expect(result).toMatchObject({outcome:'LOSS',players:[{username:'Bob',before:800,after:792,passed:4,submitted:null},{username:'Ada',cpu:12.5,submitted:1500}]});
    expect(new Date(result!.completedAt!).toISOString()).toBe('2026-01-02T03:04:00.000Z');
    expect(JSON.stringify(result)).not.toContain('SECRET');
    await db.query("UPDATE matches SET winner_id=NULL WHERE id=$1",[m.id]);
    expect((await loadResult(store,m.id,users[0].id))?.outcome).toBe('DRAW');
    await db.query("UPDATE matches SET completed_at=now()+interval '1 day' WHERE id=$1",[m.id]);
    expect(await loadResult(store,m.id,users[0].id)).toBeNull();
  } finally { await db.close(); }
},30000);
