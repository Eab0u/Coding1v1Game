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

it.each(['accepted','declined','cancelled','expired'])('stops polling an authoritative %s invitation and shows its next action',async(status)=>{
 vi.useFakeTimers();
 try {
  const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({status,outgoing:false,matchId:status==='accepted'?'next':null})});
  vi.stubGlobal('fetch',fetcher);
  render(<Rematch id="old"/>);
  const announcement=screen.getByRole('status');
  await act(async()=>{});
  expect(screen.getByRole('status')).toBe(announcement);
  expect(announcement).toHaveAttribute('aria-live','polite');
  expect(announcement).toHaveAttribute('aria-atomic','true');
  expect(screen.getByRole('status')).toHaveTextContent(status==='accepted'?'Rematch accepted':status==='declined'?'rematch was declined':status==='cancelled'?'invitation was cancelled':'invitation expired');
  const link=screen.getByRole('link',{name:status==='accepted'?'Open rematch arena':'Find a new opponent'});
  expect(link).toHaveAttribute('href',status==='accepted'?'/match/next':'/');
  await act(async()=>{await vi.advanceTimersByTimeAsync(30000);});
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
 } finally {vi.useRealTimers();}
});

it('stops polling after a terminal action response and starts fresh for another match',async()=>{
 vi.useFakeTimers();
 try {
  const fetcher=vi.fn().mockResolvedValueOnce(response('pending')).mockResolvedValueOnce(response('cancelled')).mockResolvedValue(response('none'));
  vi.stubGlobal('fetch',fetcher);
  const view=render(<Rematch id="old"/>);
  await act(async()=>{});
  fireEvent.click(screen.getByRole('button',{name:'Cancel invitation'}));
  await act(async()=>{});
  expect(screen.getByRole('status')).toHaveTextContent('invitation was cancelled');
  await act(async()=>{await vi.advanceTimersByTimeAsync(30000);});
  expect(fetcher).toHaveBeenCalledTimes(2);
  view.rerender(<Rematch id="other"/>);
  await act(async()=>{});
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(screen.getByRole('button',{name:'Rematch'})).toBeEnabled();
  await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});
  expect(fetcher).toHaveBeenCalledTimes(4);
 } finally {vi.useRealTimers();}
});

it('continues polling pending invitations until the server reports expiry',async()=>{
 vi.useFakeTimers();
 try {
  const fetcher=vi.fn().mockResolvedValueOnce(response('pending')).mockResolvedValue(response('expired'));
  vi.stubGlobal('fetch',fetcher);
  render(<Rematch id="old"/>);
  await act(async()=>{});
  expect(screen.getByRole('button',{name:'Cancel invitation'})).toBeEnabled();
  await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});
  expect(screen.getByRole('status')).toHaveTextContent('invitation expired');
  await act(async()=>{await vi.advanceTimersByTimeAsync(30000);});
  expect(fetcher).toHaveBeenCalledTimes(2);
 } finally {vi.useRealTimers();}
});


it.each([
 ['invite','none',true,'Rematch','Sending invitation'],
 ['accept','pending',false,'Accept rematch','Accepting rematch'],
 ['decline','pending',false,'Decline','Declining invitation'],
 ['cancel','pending',true,'Cancel invitation','Cancelling invitation'],
] as const)('announces %s while awaiting confirmation and restores controls after failure',async(action,status,outgoing,label,message)=>{
 const pending=deferred<{ok:boolean;json:()=>Promise<{error:string}>}>();
 const initial={ok:true,json:async()=>({status,outgoing,matchId:null})};
 const fetcher=vi.fn().mockResolvedValueOnce(initial).mockReturnValueOnce(pending.promise).mockResolvedValue(initial);
 vi.stubGlobal('fetch',fetcher);
 render(<Rematch id="old"/>);
 const button=await screen.findByRole('button',{name:label});
 fireEvent.click(button);
 expect(screen.getByRole('status')).toHaveTextContent(message);
 expect(screen.getByRole('status')).toHaveClass('rematch-pending');
 for (const control of screen.getAllByRole('button')) expect(control).toBeDisabled();
 fireEvent.click(button);
 expect(fetcher).toHaveBeenCalledTimes(2);
 expect(fetcher).toHaveBeenLastCalledWith(`/api/matches/old/rematch?action=${action}`,expect.objectContaining({method:'POST'}));
 await act(async()=>{pending.resolve({ok:false,json:async()=>({error:'Please try again.'})});});
 expect(screen.getByRole('alert')).toHaveTextContent('Please try again.');
 expect(screen.getByRole('status')).not.toHaveTextContent(message);
 expect(screen.getByRole('status')).not.toHaveClass('rematch-pending');
 expect(screen.getByRole('button',{name:label})).toBeEnabled();
});

it('replaces sending feedback with the confirmed invitation state',async()=>{
 const pending=deferred<ReturnType<typeof response>>();
 const fetcher=vi.fn().mockResolvedValueOnce(response('none')).mockReturnValueOnce(pending.promise).mockResolvedValue(response('pending'));
 vi.stubGlobal('fetch',fetcher);
 render(<Rematch id="old"/>);
 fireEvent.click(await screen.findByRole('button',{name:'Rematch'}));
 expect(screen.getByRole('status')).toHaveTextContent('Sending invitation');
 await act(async()=>{pending.resolve(response('pending'));});
 expect(screen.getByRole('status')).toHaveTextContent('Waiting for your opponent');
 expect(screen.getByRole('status')).not.toHaveClass('rematch-pending');
 expect(screen.getByRole('button',{name:'Cancel invitation'})).toBeEnabled();
});

it('retries failed invitation reads immediately without overlapping requests and clears recovery on success',async()=>{
 vi.useFakeTimers();
 try {
  const pending=deferred<ReturnType<typeof response>>();
  const fetcher=vi.fn().mockRejectedValueOnce(new Error('offline')).mockReturnValueOnce(pending.promise).mockResolvedValue(response('none'));
  vi.stubGlobal('fetch',fetcher);
  render(<Rematch id="old"/>);
  await act(async()=>{});
  expect(screen.getByRole('alert')).toHaveTextContent('Automatic retries continue');
  const retry=screen.getByRole('button',{name:'Retry invitation update'});
  fireEvent.click(retry);
  expect(retry).toBeDisabled();
  expect(screen.getByText('Refreshing invitation...')).toHaveAttribute('role','status');
  fireEvent.click(retry);
  await act(async()=>{await vi.advanceTimersByTimeAsync(6000);});
  expect(fetcher).toHaveBeenCalledTimes(2);
  await act(async()=>{pending.resolve(response('none'));});
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Retry invitation update'})).not.toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Rematch'})).toBeEnabled();
  await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});
  expect(fetcher).toHaveBeenCalledTimes(3);
 } finally {vi.useRealTimers();}
});

it('keeps recovery available after another failed read and aborts a retry on navigation',async()=>{
 const pending=deferred<ReturnType<typeof response>>();
 const fetcher=vi.fn().mockRejectedValueOnce(new Error('offline')).mockRejectedValueOnce(new Error('offline')).mockReturnValueOnce(pending.promise).mockResolvedValue(response('none'));
 vi.stubGlobal('fetch',fetcher);
 const view=render(<Rematch id="old"/>);
 fireEvent.click(await screen.findByRole('button',{name:'Retry invitation update'}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Retry invitation update'})).toBeEnabled());
 fireEvent.click(screen.getByRole('button',{name:'Retry invitation update'}));
 const signal=fetcher.mock.calls[2][1].signal as AbortSignal;
 view.rerender(<Rematch id="new"/>);
 expect(signal.aborted).toBe(true);
 await screen.findByRole('button',{name:'Rematch'});
 await act(async()=>{pending.resolve(response('expired'));});
 expect(screen.queryByText(/invitation expired/)).not.toBeInTheDocument();
 expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('refreshes on tab return without overlapping reads and stops after expiry',async()=>{
 vi.useFakeTimers();
 const visibility=vi.spyOn(document,'visibilityState','get');
 try {
  const pending=deferred<ReturnType<typeof response>>();
  const fetcher=vi.fn().mockResolvedValueOnce(response('pending')).mockReturnValueOnce(pending.promise);
  vi.stubGlobal('fetch',fetcher);
  const view=render(<Rematch id="old"/>);
  await act(async()=>{});
  visibility.mockReturnValue('hidden');
  fireEvent(document,new Event('visibilitychange'));
  expect(fetcher).toHaveBeenCalledTimes(1);
  visibility.mockReturnValue('visible');
  fireEvent(document,new Event('visibilitychange'));
  fireEvent(document,new Event('visibilitychange'));
  await act(async()=>{await vi.advanceTimersByTimeAsync(6000);});
  expect(fetcher).toHaveBeenCalledTimes(2);
  await act(async()=>{pending.resolve(response('expired'));});
  expect(screen.getByRole('status')).toHaveTextContent('invitation expired');
  fireEvent(document,new Event('visibilitychange'));
  await act(async()=>{await vi.advanceTimersByTimeAsync(6000);});
  expect(fetcher).toHaveBeenCalledTimes(2);
  view.unmount();
  fireEvent(document,new Event('visibilitychange'));
  expect(fetcher).toHaveBeenCalledTimes(2);
 } finally {visibility.mockRestore();vi.useRealTimers();}
});

it('does not refresh on tab return during an invitation action',async()=>{
 const pending=deferred<ReturnType<typeof response>>();
 const fetcher=vi.fn().mockResolvedValueOnce(response('none')).mockReturnValueOnce(pending.promise).mockResolvedValue(response('pending'));
 vi.stubGlobal('fetch',fetcher);
 const visibility=vi.spyOn(document,'visibilityState','get').mockReturnValue('visible');
 try {
  render(<Rematch id="old"/>);
  fireEvent.click(await screen.findByRole('button',{name:'Rematch'}));
  fireEvent(document,new Event('visibilitychange'));
  expect(fetcher).toHaveBeenCalledTimes(2);
  await act(async()=>{pending.resolve(response('pending'));});
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(screen.getByRole('status')).toHaveTextContent('Waiting for your opponent');
 } finally {visibility.mockRestore();}
});

it('restarts the poll delay after a tab-return refresh and removes the listener on navigation',async()=>{
 vi.useFakeTimers();
 const visibility=vi.spyOn(document,'visibilityState','get').mockReturnValue('visible');
 try {
  const fetcher=vi.fn().mockResolvedValue(response('none'));
  vi.stubGlobal('fetch',fetcher);
  const view=render(<Rematch id="old"/>);
  await act(async()=>{});
  await act(async()=>{await vi.advanceTimersByTimeAsync(1500);});
  await act(async()=>{fireEvent(document,new Event('visibilitychange'));});
  expect(fetcher).toHaveBeenCalledTimes(2);
  await act(async()=>{await vi.advanceTimersByTimeAsync(500);});
  expect(fetcher).toHaveBeenCalledTimes(2);
  await act(async()=>{await vi.advanceTimersByTimeAsync(1500);});
  expect(fetcher).toHaveBeenCalledTimes(3);
  view.unmount();
  fireEvent(document,new Event('visibilitychange'));
  await act(async()=>{await vi.advanceTimersByTimeAsync(4000);});
  expect(fetcher).toHaveBeenCalledTimes(3);
 } finally {visibility.mockRestore();vi.useRealTimers();}
});

it('counts down from server time despite local clock skew and awaits authoritative expiry',async()=>{
 vi.useFakeTimers();
 try {
  vi.setSystemTime(new Date('2040-01-01'));
  const pending={status:'pending',outgoing:false,matchId:null,serverNow:'2026-11-06T12:00:00Z',expiresAt:'2026-11-06T12:00:03Z'};
  const stalled=deferred<ReturnType<typeof response>>();
  const fetcher=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>pending}).mockReturnValueOnce(stalled.promise).mockResolvedValue(response('expired'));
  vi.stubGlobal('fetch',fetcher);
  const view=render(<Rematch id="old"/>);
  await act(async()=>{});
  expect(screen.getByRole('timer')).toHaveTextContent('3s remaining');
  expect(screen.getByRole('timer')).toHaveAttribute('aria-live','off');
  await act(async()=>{await vi.advanceTimersByTimeAsync(3000);});
  expect(screen.getByRole('timer')).toHaveTextContent('0s remaining');
  expect(screen.getByRole('button',{name:'Accept rematch'})).toBeDisabled();
  expect(screen.getByRole('button',{name:'Decline'})).toBeDisabled();
  expect(screen.getByText(/Waiting for server confirmation\./)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Accept rematch'}));
  expect(fetcher).toHaveBeenCalledTimes(2);
  await act(async()=>{stalled.resolve(response('expired'));});
  expect(screen.queryByRole('timer')).not.toBeInTheDocument();
  expect(screen.getByRole('link',{name:'Find a new opponent'})).toBeInTheDocument();
  view.unmount();
 } finally {vi.useRealTimers();}
});
it('omits countdown for unavailable server timestamps',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({status:'pending',outgoing:true,serverNow:'invalid',expiresAt:'invalid'})}));
 render(<Rematch id="old"/>);
 expect(await screen.findByRole('button',{name:'Cancel invitation'})).toBeEnabled();
 expect(screen.queryByRole('timer')).not.toBeInTheDocument();
});
it.each([true,false])('disables elapsed invitations on reopening and cleans up on navigation (outgoing=%s)',async(outgoing)=>{
 vi.useFakeTimers();
 try {
  const pending={status:'pending',outgoing,serverNow:'2026-11-06T12:00:00Z',expiresAt:'2026-11-06T11:59:59Z'};
  const fetcher=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>pending}).mockResolvedValue(response('none'));
  vi.stubGlobal('fetch',fetcher);
  const view=render(<Rematch id="old"/>);
  await act(async()=>{});
  expect(screen.getByRole('button',{name:outgoing?'Cancel invitation':'Accept rematch'})).toBeDisabled();
  expect(screen.getByText(/The invitation window has ended/)).toBeInTheDocument();
  view.rerender(<Rematch id="new"/>);
  await act(async()=>{});
  expect(screen.queryByRole('timer')).not.toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Rematch'})).toBeEnabled();
  view.unmount();
  await act(async()=>{await vi.advanceTimersByTimeAsync(10000);});
  expect(fetcher).toHaveBeenCalledTimes(2);
 } finally {vi.useRealTimers();}
});

it.each([true,false])('retires expired invitation prompts for outgoing=%s, including delayed actions',async(outgoing)=>{
 vi.useFakeTimers();
 try {
  const pending={status:'pending',outgoing,serverNow:'2026-11-06T12:00:00Z',expiresAt:'2026-11-06T12:00:01Z'};
  const delayed=deferred<ReturnType<typeof response>>();
  const fetcher=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>pending}).mockReturnValueOnce(delayed.promise).mockResolvedValue(response('expired'));
  vi.stubGlobal('fetch',fetcher);
  render(<Rematch id="old"/>);
  await act(async()=>{});
  const message=screen.getByText(outgoing?'Waiting for your opponent. Invitation expires after 60 seconds.':'Your opponent invited you to a fresh ranked duel. Accept within 60 seconds.');
  fireEvent.click(screen.getByRole('button',{name:outgoing?'Cancel invitation':'Accept rematch'}));
  expect(message).toHaveClass('rematch-pending');
  await act(async()=>{await vi.advanceTimersByTimeAsync(1000);});
  expect(message).toHaveTextContent('The invitation window has ended.');
  expect(message).toHaveTextContent('no rematch is confirmed yet');
  expect(message).toHaveAttribute('aria-live','polite');
  expect(message).not.toHaveClass('rematch-pending');
  await act(async()=>{delayed.resolve(response('accepted'));});
  expect(screen.getByRole('status')).toBe(message);
  expect(message).toHaveTextContent('Rematch accepted. Your next arena is ready.');
  expect(message).toHaveAttribute('aria-atomic','true');
  expect(message).toHaveClass('rematch-summary');
  expect(screen.queryByText(/The invitation window has ended/)).not.toBeInTheDocument();
 } finally {vi.useRealTimers();}
});
it.each(['accepted','declined','cancelled','expired'])('preserves the polite announcement region from loading through polled %s confirmation',async(status)=>{
 vi.useFakeTimers();
 try {
  const fetcher=vi.fn().mockResolvedValueOnce(response('pending')).mockResolvedValue({ok:true,json:async()=>({status,outgoing:false,matchId:status==='accepted'?'next':null})});
  vi.stubGlobal('fetch',fetcher);
  render(<Rematch id="old"/>);
  const announcement=screen.getByRole('status');
  expect(announcement).toHaveTextContent('Checking invitation');
  await act(async()=>{});
  expect(screen.getByRole('status')).toBe(announcement);
  await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});
  expect(screen.getByRole('status')).toBe(announcement);
  expect(announcement).toHaveAttribute('aria-live','polite');
  expect(announcement).toHaveAttribute('aria-atomic','true');
  expect(announcement).toHaveClass('rematch-summary');
  expect(announcement).not.toHaveClass('rematch-pending');
  expect(announcement).toHaveTextContent(status==='accepted'?'Rematch accepted':status==='declined'?'rematch was declined':status==='cancelled'?'invitation was cancelled':'invitation expired');
  const settledText=announcement.textContent;
  await act(async()=>{await vi.advanceTimersByTimeAsync(10000);});
  expect(announcement.textContent).toBe(settledText);
  expect(fetcher).toHaveBeenCalledTimes(2);
 } finally {vi.useRealTimers();}
});

it.each(['accepted','declined','cancelled','expired'])('retires failed action feedback after authoritative %s confirmation',async(status)=>{
 vi.useFakeTimers();
 try {
  const fetcher=vi.fn().mockResolvedValueOnce(response('pending'))
   .mockResolvedValueOnce({ok:false,json:async()=>({error:'Try accepting again.'})})
   .mockResolvedValueOnce(response('pending'))
   .mockResolvedValue({ok:true,json:async()=>({status,matchId:status==='accepted'?'next':null})});
  vi.stubGlobal('fetch',fetcher);
  render(<Rematch id="old"/>);
  await act(async()=>{});
  fireEvent.click(screen.getByRole('button',{name:'Cancel invitation'}));
  await act(async()=>{});
  expect(screen.getByRole('alert')).toHaveTextContent('Try accepting again.');
  await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveClass('rematch-summary');
  expect(screen.getByRole('link',{name:status==='accepted'?'Open rematch arena':'Find a new opponent'})).toBeInTheDocument();
 } finally {vi.useRealTimers();}
});
it.each([true,false])('retires failed invitation actions at the local deadline (outgoing=%s)',async(outgoing)=>{
 vi.useFakeTimers();
 try {
  const pending={status:'pending',outgoing,serverNow:'2026-11-06T12:00:00Z',expiresAt:'2026-11-06T12:00:01Z'};
  const snapshot={ok:true,json:async()=>pending};
  const failure={ok:false,json:async()=>({error:'Try that action again.'})};
  const fetcher=vi.fn().mockResolvedValueOnce(snapshot).mockResolvedValueOnce(failure).mockResolvedValueOnce(snapshot).mockResolvedValue(response('expired'));
  vi.stubGlobal('fetch',fetcher);
  render(<Rematch id="old"/>);
  await act(async()=>{});
  const button=screen.getByRole('button',{name:outgoing?'Cancel invitation':'Accept rematch'});
  fireEvent.click(button);
  await act(async()=>{});
  expect(screen.getByRole('alert')).toHaveTextContent('Try that action again.');
  await act(async()=>{await vi.advanceTimersByTimeAsync(1000);});
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByText(/The invitation window has ended/)).toBeInTheDocument();
  expect(button).toBeDisabled();
 } finally {vi.useRealTimers();}
});
it.each([true,false])('withholds a delayed action failure after expiry (outgoing=%s)',async(outgoing)=>{
 vi.useFakeTimers();
 try {
  const pending={status:'pending',outgoing,serverNow:'2026-11-06T12:00:00Z',expiresAt:'2026-11-06T12:00:01Z'};
  const delayed=deferred<{ok:boolean;json:()=>Promise<{error:string}>}>();
  const fetcher=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>pending}).mockReturnValueOnce(delayed.promise).mockResolvedValue(response('expired'));
  vi.stubGlobal('fetch',fetcher);
  render(<Rematch id="old"/>);
  await act(async()=>{});
  fireEvent.click(screen.getByRole('button',{name:outgoing?'Cancel invitation':'Accept rematch'}));
  await act(async()=>{await vi.advanceTimersByTimeAsync(1000);});
  expect(screen.getByText(/The invitation window has ended/)).toBeInTheDocument();
  await act(async()=>{delayed.resolve({ok:false,json:async()=>({error:'Try again.'})});});
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('invitation expired');
 } finally {vi.useRealTimers();}
});
