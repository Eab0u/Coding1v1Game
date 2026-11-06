import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {it,expect,vi,afterEach} from 'vitest';
import {Rematch} from '../src/components/rematch';
afterEach(()=>vi.unstubAllGlobals());
it('offers consent controls and links both players to the accepted arena',async()=>{
 const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({status:'pending',outgoing:false,matchId:null})});
 vi.stubGlobal('fetch',fetcher);
 render(<Rematch id="old"/>);
 fireEvent.click(await screen.findByRole('button',{name:'Accept rematch'}));
 await waitFor(()=>expect(fetcher).toHaveBeenCalledWith('/api/matches/old/rematch?action=accept',expect.objectContaining({method:'POST'})));
 fetcher.mockResolvedValue({ok:true,json:async()=>({status:'accepted',outgoing:false,matchId:'new'})});
 await screen.findByRole('link',{name:'Open rematch arena'}, {timeout:4000});
 expect(screen.getByRole('link',{name:'Open rematch arena'})).toHaveAttribute('href','/match/new');
});
it('sends invitations explicitly and displays safe action errors',async()=>{
 const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({status:'none'})});
 vi.stubGlobal('fetch',fetcher);render(<Rematch id="old"/>);
 const button=await screen.findByRole('button',{name:'Rematch'});
 fetcher.mockResolvedValue({ok:false,json:async()=>({error:'Invitation is no longer available.'})});
 fireEvent.click(button);
 expect(await screen.findByRole('alert')).toHaveTextContent('Invitation is no longer available.');
});
