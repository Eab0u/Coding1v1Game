import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
const mocks=vi.hoisted(()=>({current:vi.fn(),load:vi.fn()}));
vi.mock('next/headers',()=>({cookies:async()=>({get:()=>({value:'token'})})}));
vi.mock('next/navigation',()=>({redirect:()=>{throw new Error('REDIRECT');},notFound:()=>{throw new Error('NOT_FOUND');}}));
vi.mock('../src/lib/auth-server',()=>({auth:{current:mocks.current},database:()=>({})}));
vi.mock('../src/lib/results',()=>({loadResult:mocks.load}));
import Page from '../src/app/match/[id]/results/page';
const params=Promise.resolve({id:'match-id'});
beforeEach(()=>{mocks.current.mockResolvedValue({id:'viewer'});mocks.load.mockResolvedValue(null);});
it('requires authentication before loading results',async()=>{
 mocks.current.mockResolvedValue(null);
 await expect(Page({params})).rejects.toThrow('REDIRECT');
 expect(mocks.load).not.toHaveBeenCalled();
});
it('uses session identity and returns a generic 404 for unavailable results',async()=>{
 await expect(Page({params})).rejects.toThrow('NOT_FOUND');
 expect(mocks.load).toHaveBeenCalledWith({},'match-id','viewer');
});
it('contains infrastructure failures',async()=>{
 mocks.load.mockRejectedValue(new Error('SECRET'));
 render(await Page({params}));
 expect(screen.getByRole('alert')).toHaveTextContent('Results unavailable');
 expect(screen.queryByText('SECRET')).not.toBeInTheDocument();
});
