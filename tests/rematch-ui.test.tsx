import {act,render,screen,fireEvent,waitFor} from '@testing-library/react';
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

function deferred<T>() {
 let resolve!: (value:T)=>void;
 const promise=new Promise<T>(done=>{resolve=done;});
 return {promise,resolve};
}
const response=(status:string)=>({ok:true,json:async()=>({status,outgoing:true,matchId:null})});
it('ignores a stale poll while an action is pending and resumes after failure',async()=>{
 vi.useFakeTimers();
 try {
  const stale=deferred<ReturnType<typeof response>>();
  const action=deferred<{ok:boolean;json:()=>Promise<{error:string}>}>();
  const fetcher=vi.fn().mockResolvedValueOnce(response('none')).mockReturnValueOnce(stale.promise).mockReturnValueOnce(action.promise).mockResolvedValue(response('pending'));
  vi.stubGlobal('fetch',fetcher);
  render(<Rematch id="old"/>);
  await act(async()=>{});
  await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});
  fireEvent.click(screen.getByRole('button',{name:'Rematch'}));
  expect(fetcher).toHaveBeenCalledTimes(3);
  await act(async()=>{stale.resolve(response('cancelled'));});
  expect(screen.queryByText('Invitation cancelled.')).not.toBeInTheDocument();
  await act(async()=>{await vi.advanceTimersByTimeAsync(6000);});
  expect(fetcher).toHaveBeenCalledTimes(3);
  await act(async()=>{action.resolve({ok:false,json:async()=>({error:'Try again.'})});});
  expect(fetcher).toHaveBeenCalledTimes(4);
  expect(screen.getByRole('button',{name:'Cancel invitation'})).toBeEnabled();
 } finally {vi.useRealTimers();}
});
it('resets invitation state on match change and aborts old actions',async()=>{
 const pending=deferred<ReturnType<typeof response>>();
 const fetcher=vi.fn().mockResolvedValueOnce(response('none')).mockReturnValueOnce(pending.promise).mockResolvedValue(response('none'));
 vi.stubGlobal('fetch',fetcher);
 const view=render(<Rematch id="old"/>);
 fireEvent.click(await screen.findByRole('button',{name:'Rematch'}));
 const signal=fetcher.mock.calls[1][1].signal as AbortSignal;
 view.rerender(<Rematch id="new"/>);
 expect(signal.aborted).toBe(true);
 expect(screen.getByRole('status')).toHaveTextContent('Checking invitation');
 await screen.findByRole('button',{name:'Rematch'});
 await act(async()=>{pending.resolve(response('accepted'));});
 expect(screen.queryByText('Invitation accepted.')).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Rematch'}));
 await waitFor(()=>expect(fetcher).toHaveBeenCalledWith('/api/matches/new/rematch?action=invite',expect.anything()));
});

it('aborts an in-flight action when the invitation view unmounts',async()=>{
 const pending=deferred<ReturnType<typeof response>>();
 const fetcher=vi.fn().mockResolvedValueOnce(response('none')).mockReturnValueOnce(pending.promise);
 vi.stubGlobal('fetch',fetcher);
 const view=render(<Rematch id="old"/>);
 fireEvent.click(await screen.findByRole('button',{name:'Rematch'}));
 const signal=fetcher.mock.calls[1][1].signal as AbortSignal;
 view.unmount();
 expect(signal.aborted).toBe(true);
 await act(async()=>{pending.resolve(response('pending'));});
 expect(fetcher).toHaveBeenCalledTimes(2);
});
