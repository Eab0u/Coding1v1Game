// @vitest-environment node
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import type { Pool } from "pg";
import { expect, it } from "vitest";
import { loadArena } from "../src/lib/arena";
it("restricts matches to participants and projects public problem and latest judged progress only",async()=>{
  const db=new PGlite();
  try {
    await db.exec(await readFile(new URL('../db/migrations/001_initial.sql',import.meta.url),'utf8'));
    await db.exec(await readFile(new URL('../db/migrations/005_match_lifecycle.sql',import.meta.url),'utf8'));
    await db.exec(`INSERT INTO users(username,password_hash) VALUES ('Ada','SECRET'),('Bob','SECRET'),('Eve','SECRET');
      INSERT INTO problems(slug,title,statement,function_signature,difficulty,constraints,reference_solution,brute_force_solution,test_generator,hidden_tests,cpu_limit_ms,memory_limit_kb)
      VALUES ('sample','Sample','Statement','def solve():','easy','Constraints','SECRET','SECRET','SECRET','[]',1000,65536);
      INSERT INTO matches(problem_id,player_one_id,player_two_id) SELECT p.id,a.id,b.id FROM problems p,users a,users b WHERE a.username='Ada' AND b.username='Bob';`);
    const {rows:[m]}=await db.query<{id:string}>("SELECT id FROM matches");
    const {rows:users}=await db.query<{id:string;username:string}>("SELECT id,username FROM users ORDER BY username");
    const store=db as unknown as Pool;
    const {rows:[reservation]}=await db.query<{expires:Date}>("SELECT created_at + interval '60 seconds' AS expires FROM matches WHERE id=$1",[m.id]);
    expect((await loadArena(store,m.id,users[0].id))?.reservationExpiresAt).toBe(reservation.expires.toISOString());
    expect(await loadArena(store,m.id,users[2].id)).toBeNull();
    expect(await loadArena(store,"invalid",users[0].id)).toBeNull();
    expect(await loadArena(store,m.id,users[0].id)).toMatchObject({status:'pending',deadline:null,progress:null,opponent:{username:'Bob'}});
    expect(await loadArena(store,m.id,users[0].id)).toMatchObject({player:{ready:false},opponent:{ready:false}});
    await db.query('UPDATE matches SET player_one_ready=true WHERE id=$1',[m.id]);
    expect(await loadArena(store,m.id,users[0].id)).toMatchObject({player:{ready:true},opponent:{ready:false}});
    expect(await loadArena(store,m.id,users[1].id)).toMatchObject({player:{ready:false},opponent:{ready:true}});
    await db.query(`INSERT INTO submissions(match_id,user_id,source_code,status,tests_passed,tests_total,submitted_at) VALUES
      ($1,$2,'SECRET','judged',2,8,now()-interval '1 minute'),($1,$2,'SECRET','judged',5,8,now()),($1,$2,'SECRET','running',NULL,NULL,now()+interval '1 second')`,[m.id,users[1].id]);
    const result=await loadArena(store,m.id,users[0].id);
    expect(result?.progress).toEqual({passed:5,total:8});
    expect(JSON.stringify(result)).not.toContain('SECRET');
    const opponent=await loadArena(store,m.id,users[1].id);
    expect(opponent?.progress).toBeNull();
    expect(opponent?.submission).toMatchObject({id:expect.any(String),status:'running',passed:null,total:null});
  } finally { await db.close(); }
},30000);
