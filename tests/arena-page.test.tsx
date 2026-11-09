import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
const mocks=vi.hoisted(()=>({current:vi.fn(),load:vi.fn()}));
vi.mock('next/headers',()=>({cookies:async()=>({get:()=>({value:'token'})})}));
vi.mock('next/navigation',()=>({redirect:()=>{throw new Error('REDIRECT');},notFound:()=>{throw new Error('NOT_FOUND');}}));
vi.mock('../src/lib/auth-server',()=>({auth:{current:mocks.current},database:()=>({})}));
vi.mock('../src/lib/arena',()=>({loadArena:mocks.load}));
vi.mock('../src/components/arena',()=>({Arena:({initial}:{initial:{id:string}})=><div>Recovered duel {initial.id}</div>}));
import Page from '../src/app/match/[id]/page';
const params=Promise.resolve({id:'match-id'});
beforeEach(()=>{mocks.current.mockResolvedValue({id:'viewer'});mocks.load.mockResolvedValue(null);});
it('requires authentication before loading arena',async()=>{
 mocks.current.mockResolvedValue(null);
 await expect(Page({params})).rejects.toThrow('REDIRECT');
 expect(mocks.load).not.toHaveBeenCalled();
});
it('uses session identity and returns a generic 404 for unavailable arena',async()=>{
 await expect(Page({params})).rejects.toThrow('NOT_FOUND');
 expect(mocks.load).toHaveBeenCalledWith({},'match-id','viewer');
});
it('contains infrastructure failures',async()=>{
 mocks.load.mockRejectedValue(new Error('SECRET'));
 render(await Page({params}));
 expect(screen.getByRole('alert')).toHaveTextContent('Arena unavailable');
 expect(screen.queryByText('SECRET')).not.toBeInTheDocument();
 expect(screen.getByRole('link',{name:'Retry duel'})).toHaveAttribute('href','/match/match-id');
 expect(screen.getByRole('link',{name:'Back to arena'})).toHaveAttribute('href','/');
});
it('contains session failures without reading private arena',async()=>{
 mocks.current.mockRejectedValue(new Error('SESSION_SECRET'));
 render(await Page({params}));
 expect(screen.getByRole('alert')).toHaveTextContent('Arena unavailable');
 expect(screen.queryByText('SESSION_SECRET')).not.toBeInTheDocument();
 expect(mocks.load).not.toHaveBeenCalled();
});
it('rechecks session identity and loads the same match on a fresh retry',async()=>{
 mocks.load.mockRejectedValueOnce(new Error('offline'));
 const view=render(await Page({params}));
 expect(screen.getByRole('link',{name:'Retry duel'})).toHaveAttribute('href','/match/match-id');
 mocks.current.mockResolvedValue({id:'new-viewer'});
 mocks.load.mockResolvedValue({id:'match-id'});
 view.rerender(await Page({params}));
 expect(mocks.load).toHaveBeenLastCalledWith({},'match-id','new-viewer');
 expect(screen.getByText('Recovered duel match-id')).toBeVisible();
 expect(screen.queryByRole('link',{name:'Retry duel'})).not.toBeInTheDocument();
});
it('redirects on retry if the session expired',async()=>{
 mocks.load.mockRejectedValueOnce(new Error('offline'));
 await Page({params});
 mocks.current.mockResolvedValue(null);
 mocks.load.mockClear();
 await expect(Page({params})).rejects.toThrow('REDIRECT');
 expect(mocks.load).not.toHaveBeenCalled();
});

it('encodes the requested match in the recovery link',async()=>{
 mocks.load.mockRejectedValue(new Error('offline'));
 render(await Page({params:Promise.resolve({id:'match/with?reserved#characters'})}));
 expect(screen.getByRole('link',{name:'Retry duel'})).toHaveAttribute('href','/match/match%2Fwith%3Freserved%23characters');
});
