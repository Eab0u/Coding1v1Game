// @vitest-environment node
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import type {Pool} from 'pg';
import {it,expect} from 'vitest';
import {rematch} from '../src/lib/rematch';
it('requires consent, enforces expiry and permissions, reserves exactly once and rolls back busy acceptance',async()=>{
 const db=new PGlite();
 try {
 await db.exec(await readFile(new URL('../db/migrations/001_initial.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../db/migrations/006_rematches.sql',import.meta.url),'utf8'));
    await db.exec(`INSERT INTO users(username,password_hash) VALUES ('Ada','SECRET'),('Bob','SECRET'),('Eve','SECRET');
      INSERT INTO problems(slug,title,statement,function_signature,difficulty,constraints,reference_solution,brute_force_solution,test_generator,hidden_tests,cpu_limit_ms,memory_limit_kb)
      VALUES ('sample','Sample','Statement','def solve():','easy','Constraints','SECRET','SECRET','SECRET','[]',1000,65536);
      INSERT INTO matches(problem_id,player_one_id,player_two_id) SELECT p.id,a.id,b.id FROM problems p,users a,users b WHERE a.username='Ada' AND b.username='Bob';`);

 const {rows:[m]}=await db.query<{id:string}>('SELECT id FROM matches');
 const {rows:u}=await db.query<{id:string}>('SELECT id FROM users ORDER BY username');
 const pool={connect:async()=>({query:db.query.bind(db),release(){}})} as unknown as Pool;
 const run=(actor=0,action='view')=>rematch(pool,m.id,u[actor].id,action);
 await expect(run()).rejects.toMatchObject({status:404});
 await db.query("UPDATE matches SET status='completed',completed_at=now()");
 await expect(run(2,'invite')).rejects.toMatchObject({status:404});
 expect((await run()).status).toBe('none');
 expect(await run(0,'invite')).toMatchObject({status:'pending',outgoing:true,matchId:null});
 expect((await run(0,'invite')).status).toBe('pending');
 expect(await run(1)).toMatchObject({status:'pending',outgoing:false});
 await expect(run(0,'accept')).rejects.toMatchObject({status:403});
 await expect(run(1,'cancel')).rejects.toMatchObject({status:403});
 await expect(run(1,'invite')).rejects.toThrow('Accept the existing');
 await expect(run(1,'accept')).rejects.toThrow('published problem');
 expect((await run()).status).toBe('pending');
 await db.query('UPDATE problems SET published_at=now()');
 const accepted=await run(1,'accept');
 expect(accepted.status).toBe('accepted');expect(accepted.matchId).toBeTruthy();
 const recovered=await run(1,'accept');
 expect(recovered).toMatchObject({status:accepted.status,outgoing:accepted.outgoing,expiresAt:accepted.expiresAt,matchId:accepted.matchId});
 expect(Number.isFinite(Date.parse(recovered.serverNow!))).toBe(true);
 expect((await db.query('SELECT id FROM matches')).rows).toHaveLength(2);
 await db.query("UPDATE matches SET status='cancelled' WHERE id=$1",[accepted.matchId]);
 await db.query('DELETE FROM rematch_invitations');
 await run(0,'invite');await run(1,'decline');
 await expect(run(1,'accept')).rejects.toThrow('no longer');
 await db.query('DELETE FROM rematch_invitations');
 await run(0,'invite');await run(0,'cancel');
 expect((await run()).status).toBe('cancelled');
 await db.query('DELETE FROM rematch_invitations');
 await run(0,'invite');await db.query("UPDATE rematch_invitations SET expires_at=now()-interval '1 second'");
 expect((await run()).status).toBe('expired');
 await expect(run(1,'accept')).rejects.toThrow('no longer');
 await db.query('DELETE FROM rematch_invitations');
 await run(0,'invite');
 await db.query("UPDATE matches SET status='pending' WHERE id=$1",[accepted.matchId]);
 await expect(run(1,'accept')).rejects.toThrow('available');
 expect((await run()).status).toBe('pending');
 expect(JSON.stringify(await run())).not.toContain('SECRET');
 } finally {await db.close();}
},30000);
