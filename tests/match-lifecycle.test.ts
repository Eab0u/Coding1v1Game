// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import type { Pool } from 'pg';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { judgeNext, matchAction, settleMatches } from '../src/lib/match-lifecycle';
let db:PGlite, pool:Pool, id:string, one:string, two:string, eve:string;
beforeEach(async()=>{
  db=new PGlite();
  for (const file of ['001_initial.sql','004_match_results.sql','005_match_lifecycle.sql']) await db.exec(await readFile(new URL(`../db/migrations/${file}`,import.meta.url),'utf8'));
  // PGlite has one connection; tests run transactions sequentially, exercising real SQL/rollback.
  pool={query:db.query.bind(db),connect:async()=>({query:db.query.bind(db),release:()=>{}})} as unknown as Pool;
  await db.exec(`INSERT INTO users(username) VALUES ('Ada'),('Bob'),('Eve');
    INSERT INTO problems(slug,title,statement,function_signature,difficulty,constraints,reference_solution,brute_force_solution,test_generator,hidden_tests,cpu_limit_ms,memory_limit_kb,published_at)
    VALUES ('sample','Sample','Statement','def solve(nums):','easy','Constraints','SECRET','SECRET','SECRET','[{"args":[[1]],"expected":1,"benchmark":true}]',1000,65536,now());
    INSERT INTO matches(problem_id,player_one_id,player_two_id) SELECT p.id,a.id,b.id FROM problems p,users a,users b WHERE a.username='Ada' AND b.username='Bob';`);
  id=(await db.query<{id:string}>('SELECT id FROM matches')).rows[0].id;
  const users=(await db.query<{id:string;username:string}>('SELECT id,username FROM users')).rows;
  one=users.find(u=>u.username==='Ada')!.id;two=users.find(u=>u.username==='Bob')!.id;eve=users.find(u=>u.username==='Eve')!.id;
},30000);
afterEach(async()=>{await db.close();});
async function activate() {await matchAction(pool,id,one,'ready');await matchAction(pool,id,two,'ready');}
async function expire() {await db.query("UPDATE matches SET deadline_at=clock_timestamp()-interval '1 second',started_at=clock_timestamp()-interval '301 seconds' WHERE id=$1",[id]);}
const run=vi.fn(async(request)=>({testsPassed:1,testsTotal:1,largestTestsCpuMs:[10,30,20] as const,submittedAtMs:request.submittedAtMs}));
it('restricts actions, activates once with both participants and rejects late submissions',async()=>{
  await expect(matchAction(pool,id,eve,'ready')).rejects.toMatchObject({status:404});
  await expect(matchAction(pool,'bad',one,'ready')).rejects.toMatchObject({status:404});
  await expect(matchAction(pool,id,one,'submit','pass')).rejects.toMatchObject({status:409});
  expect(await matchAction(pool,id,one,'ready')).toEqual({status:'pending'});
  expect(await matchAction(pool,id,two,'ready')).toEqual({status:'active'});
  const m=(await db.query<{started_at:Date;deadline_at:Date}>('SELECT * FROM matches')).rows[0];
  expect(m.deadline_at.getTime()-m.started_at.getTime()).toBe(300000);
  await matchAction(pool,id,one,'ready');
  expect((await db.query<{started_at:Date}>('SELECT started_at FROM matches')).rows[0].started_at).toEqual(m.started_at);
  await expire();await expect(matchAction(pool,id,one,'submit','pass')).rejects.toMatchObject({status:409});
});
it('expires abandoned reservations without rating changes including late readiness',async()=>{
  await db.exec("UPDATE matches SET created_at=now()-interval '61 seconds'");
  expect(await matchAction(pool,id,one,'ready')).toEqual({status:'cancelled'});
  await settleMatches(pool);
  expect((await db.query('SELECT * FROM rating_history')).rows).toHaveLength(0);
});
it('judges only accepted code, retains median CPU, then persists ratings and final scores exactly once',async()=>{
  await activate();
  await expect(matchAction(pool,id,one,'submit',' ')).rejects.toMatchObject({status:400});
  await matchAction(pool,id,one,'submit','def solve(nums): return 1');
  await expect(matchAction(pool,id,one,'submit','pass')).rejects.toMatchObject({status:429});
  await expire(); await settleMatches(pool);
  expect((await db.query<{status:string}>('SELECT status FROM matches')).rows[0].status).toBe('active');
  expect(await judgeNext(pool,run)).toBe(true);
  expect(run).toHaveBeenLastCalledWith(expect.objectContaining({functionName:'solve',source:'def solve(nums): return 1',tests:[{args:[[1]],expected:1,benchmark:true}]}),{cpu:1000,memory:65536});
  expect(await judgeNext(pool,run)).toBe(false);
  await settleMatches(pool);await settleMatches(pool);
  expect((await db.query<{winner_id:string;status:string}>('SELECT * FROM matches')).rows[0]).toMatchObject({status:'completed',winner_id:one});
  expect((await db.query('SELECT * FROM rating_history')).rows).toHaveLength(2);
  const results=(await db.query<{user_id:string;median_cpu_ms:number;submitted_after_ms:number|null}>('SELECT * FROM match_results')).rows;
  expect(results.find(s=>s.user_id===one)).toMatchObject({median_cpu_ms:20});
  expect(results.find(s=>s.user_id===two)?.submitted_after_ms).toBeNull();
  expect((await db.query<{rating:number}>('SELECT rating FROM users WHERE id=$1',[one])).rows[0].rating).toBeGreaterThan(800);
});
it('retries infrastructure failures and abandoned leases without counting them as losses',async()=>{
  await activate();await matchAction(pool,id,one,'submit','pass');
  await judgeNext(pool,async()=>{throw new Error('offline');});
  await expire();await settleMatches(pool);
  expect((await db.query<{status:string}>('SELECT status FROM matches')).rows[0].status).toBe('active');
  expect(await judgeNext(pool,run)).toBe(false);
  await db.exec("UPDATE submissions SET status='running',retry_at=now()-interval '1 second'");
  await judgeNext(pool,run);await settleMatches(pool);
  expect((await db.query<{attempt:number;status:string}>('SELECT * FROM submissions')).rows[0]).toMatchObject({attempt:2,status:'judged'});
});
it('draws for two no-shows and rolls back all results if rating persistence fails',async()=>{
  await activate();await expire();
  await db.exec(`CREATE FUNCTION reject_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'unavailable'; END $$;
    CREATE TRIGGER fail_history BEFORE INSERT ON rating_history FOR EACH ROW EXECUTE FUNCTION reject_history();`);
  await expect(settleMatches(pool)).rejects.toThrow();
  expect((await db.query('SELECT * FROM match_results')).rows).toHaveLength(0);
  expect((await db.query<{rating:number}>('SELECT rating FROM users')).rows.every(u=>u.rating===800)).toBe(true);
  await db.exec('DROP TRIGGER fail_history ON rating_history');
  await settleMatches(pool);
  expect((await db.query<{winner_id:string|null;status:string}>('SELECT * FROM matches')).rows[0]).toMatchObject({status:'completed',winner_id:null});
});
it('selects the best score rather than the latest, enforces pacing and total limits',async()=>{
  await activate();await matchAction(pool,id,one,'submit','best');await judgeNext(pool,run);
  await expect(matchAction(pool,id,one,'submit','worse')).rejects.toMatchObject({status:429});
  await db.exec("UPDATE submissions SET submitted_at=submitted_at-interval '6 seconds'; UPDATE matches SET started_at=started_at-interval '10 seconds'");
  await matchAction(pool,id,one,'submit','worse');
  await judgeNext(pool,async r=>({testsPassed:0,testsTotal:1,largestTestsCpuMs:[1000,1000,1000],submittedAtMs:r.submittedAtMs}));
  await expire();await settleMatches(pool);
  expect((await db.query<{tests_passed:number}>('SELECT tests_passed FROM match_results WHERE user_id=$1',[one])).rows[0].tests_passed).toBe(1);
});
it('fences stale judge responses and rejects inconsistent adapter results',async()=>{
  await activate();await matchAction(pool,id,one,'submit','pass');
  await judgeNext(pool,async request=>{
    await db.exec("UPDATE submissions SET attempt=attempt+1,status='judged',tests_passed=0,tests_total=1,largest_test_cpu_ms=1000,cpu_samples='[1000,1000,1000]'");
    return {testsPassed:1,testsTotal:1,largestTestsCpuMs:[1,1,1],submittedAtMs:request.submittedAtMs};
  });
  expect((await db.query<{tests_passed:number}>('SELECT tests_passed FROM submissions')).rows[0].tests_passed).toBe(0);
  await db.exec("UPDATE submissions SET status='queued',retry_at=now()");
  await judgeNext(pool,async request=>({testsPassed:2,testsTotal:2,largestTestsCpuMs:[1,1,1],submittedAtMs:request.submittedAtMs}));
  expect((await db.query<{status:string}>('SELECT status FROM submissions')).rows[0].status).toBe('error');
});
it('enforces the per-player total submission cap and source bound',async()=>{
  await activate();
  await expect(matchAction(pool,id,one,'submit','x'.repeat(65537))).rejects.toMatchObject({status:400});
  await db.query(`INSERT INTO submissions(match_id,user_id,source_code,status,submitted_at)
    SELECT $1,$2,'pass','judged',now()-interval '1 minute' FROM generate_series(1,20)`,[id,one]);
  await expect(matchAction(pool,id,one,'submit','pass')).rejects.toMatchObject({status:429});
  expect(await matchAction(pool,id,two,'submit','pass')).toEqual({status:'queued'});
});
it.each([['medium',900000],['hard',1800000]])('uses the %s difficulty timer',async(difficulty,duration)=>{
  await db.query('UPDATE problems SET difficulty=$1',[difficulty]);await activate();
  const {rows:[m]}=await db.query<{started_at:Date;deadline_at:Date}>('SELECT * FROM matches');
  expect(m.deadline_at.getTime()-m.started_at.getTime()).toBe(duration);
});
