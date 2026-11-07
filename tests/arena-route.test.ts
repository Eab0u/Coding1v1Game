// @vitest-environment node
import { beforeEach,expect,it,vi } from "vitest";
const mocks=vi.hoisted(()=>({current:vi.fn(),load:vi.fn()}));
vi.mock('next/headers',()=>({cookies:async()=>({get:()=>({value:'session'})})}));
vi.mock('../src/lib/auth-server',()=>({auth:{current:mocks.current},database:()=>({})}));
vi.mock('../src/lib/arena',()=>({loadArena:mocks.load}));
import { GET } from '../src/app/api/matches/[id]/route';
const request=()=>GET(new Request('http://localhost/api/matches/m?userId=forged'),{params:Promise.resolve({id:'m'})});
beforeEach(()=>{vi.resetAllMocks();mocks.current.mockResolvedValue({id:'session-user'});});
it('requires authentication and uses only the session participant',async()=>{
  mocks.current.mockResolvedValueOnce(null);
  expect((await request()).status).toBe(401);
  expect(mocks.load).not.toHaveBeenCalled();
  mocks.load.mockResolvedValueOnce(null);
  const missing=await request();
  expect(missing.status).toBe(404);
  expect(mocks.load).toHaveBeenCalledWith({},'m','session-user');
  expect(missing.headers.get('Cache-Control')).toBe('private, no-store');
});
it('returns snapshots without caching and hides database errors',async()=>{
  mocks.load.mockResolvedValueOnce({id:'m',progress:null});
  const response=await request();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({id:'m',progress:null});
  mocks.load.mockRejectedValueOnce(new Error('SECRET'));
  const error=await request();
  expect(error.status).toBe(503);
  expect(await error.text()).not.toContain('SECRET');
});
