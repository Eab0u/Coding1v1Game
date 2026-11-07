// @vitest-environment node
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
const mocks=vi.hoisted(()=>({current:vi.fn(),rematch:vi.fn()}));
vi.mock('../src/lib/auth-server',()=>({auth:{current:mocks.current},database:()=>({})}));
vi.mock('../src/lib/rematch',async original=>({...await original<typeof import('../src/lib/rematch')>(),rematch:mocks.rematch}));
import {GET,POST} from '../src/app/api/matches/[id]/rematch/route';
import {RematchError} from '../src/lib/rematch';
const context={params:Promise.resolve({id:'match'})};
const request=(action='invite',origin='http://localhost')=>POST(new NextRequest(`http://localhost/api/matches/match/rematch?action=${action}`,{method:'POST',headers:{origin},body:'{"userId":"forged"}'}),context);
beforeEach(()=>{vi.resetAllMocks();vi.stubEnv('APP_ORIGIN','http://localhost');mocks.current.mockResolvedValue({id:'session-user'});mocks.rematch.mockResolvedValue({status:'none'});});
afterEach(()=>vi.unstubAllEnvs());
it('checks origin, authentication and action allowlist',async()=>{
 expect((await request('invite','https://evil.test')).status).toBe(403);
 expect((await request('unknown')).status).toBe(400);
 mocks.current.mockResolvedValue(null);
 expect((await request()).status).toBe(401);
 expect(mocks.rematch).not.toHaveBeenCalled();
});
it('uses session identity, disables caching and hides internal errors',async()=>{
 const result=await request();expect(result.status).toBe(200);
 expect(result.headers.get('cache-control')).toBe('private, no-store');
 expect(mocks.rematch).toHaveBeenCalledWith({},'match','session-user','invite');
 await GET(new NextRequest('http://localhost/api/matches/match/rematch'),context);
 expect(mocks.rematch).toHaveBeenLastCalledWith({},'match','session-user','view');
 mocks.rematch.mockRejectedValueOnce(new RematchError('Match not found.',404));
 expect((await request()).status).toBe(404);
 mocks.rematch.mockRejectedValueOnce(new Error('SECRET'));
 const failure=await request();expect(failure.status).toBe(503);expect(await failure.text()).not.toContain('SECRET');
});
