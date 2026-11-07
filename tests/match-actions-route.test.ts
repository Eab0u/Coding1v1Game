// @vitest-environment node
import { beforeEach,expect,it,vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks=vi.hoisted(()=>({current:vi.fn(),action:vi.fn()}));
vi.mock('../src/lib/auth-server',()=>({auth:{current:mocks.current},database:()=>({})}));
vi.mock('../src/lib/match-lifecycle',async importOriginal=>({...await importOriginal<typeof import('../src/lib/match-lifecycle')>(),matchAction:mocks.action}));
import { POST } from '../src/app/api/matches/[id]/route';
import { MatchActionError } from '../src/lib/match-lifecycle';
const request=(body=JSON.stringify({action:'submit',source:'pass',userId:'forged'}),origin='http://localhost')=>POST(new NextRequest('http://localhost/api/matches/m',{method:'POST',headers:{origin},body}),{params:Promise.resolve({id:'m'})});
beforeEach(()=>{vi.resetAllMocks();vi.stubEnv('APP_ORIGIN','http://localhost');mocks.current.mockResolvedValue({id:'server-user'});mocks.action.mockResolvedValue({status:'queued'});});
it('enforces origin, authentication, bounded body and valid actions',async()=>{
  expect((await request(undefined,'https://evil.test')).status).toBe(403);
  mocks.current.mockResolvedValueOnce(null);expect((await request()).status).toBe(401);
  expect((await request('a'.repeat(270001))).status).toBe(413);
  for (const body of ['oops','null','{}','{"action":"submit","source":123}','{"action":"cancel"}']) expect((await request(body)).status).toBe(400);
  expect(mocks.action).not.toHaveBeenCalled();
});
it('uses session identity, returns safe status and hides infrastructure errors',async()=>{
  const response=await request();expect(response.status).toBe(200);expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  expect(mocks.action).toHaveBeenCalledWith({},'m','server-user','submit','pass');
  mocks.action.mockRejectedValueOnce(new MatchActionError(409,'Match expired.'));expect((await request()).status).toBe(409);
  mocks.action.mockRejectedValueOnce(new Error('SECRET'));const failure=await request();expect(failure.status).toBe(503);expect(await failure.text()).not.toContain('SECRET');
});
