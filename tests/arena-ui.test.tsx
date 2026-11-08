import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DuelSound } from "../src/lib/duel-sound";
import type { ArenaSnapshot } from "../src/lib/arena";
vi.mock('next/dynamic',()=>({default:()=>function Editor({value,onChange,readOnly}:{value:string;onChange:(v:string)=>void;readOnly:boolean}) {return <textarea aria-label="Python solution" value={value} onChange={e=>onChange(e.target.value)} readOnly={readOnly}/>;}}));
import { Arena,remainingSeconds } from "../src/components/arena";
const initial:ArenaSnapshot={id:'match',status:'pending',deadline:null,serverTime:'2026-11-06T12:00:00Z',player:{username:'Ada',rating:800},opponent:{username:'Bob',rating:900},problem:{title:'Sample',statement:'Find an answer',signature:'def solve():',difficulty:'easy',constraints:'n <= 100',examples:[{input:[1],output:1}]},progress:null};
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks();sessionStorage.clear();localStorage.clear();});
function leaveIsGuarded() {
  const event=new Event('beforeunload',{cancelable:true});
  window.dispatchEvent(event);
  return event.defaultPrevented;
}
it('explains closed submissions when reopening an expired active duel',()=>{
  render(<Arena initial={{...initial,status:'active',deadline:initial.serverTime}}/>);
  expect(screen.getByRole('button',{name:'Submit solution'})).toHaveAccessibleDescription(/Submissions are closed.*confirm results/);
});
it.each(['pending','acknowledged','failed'] as const)('retires %s submission action feedback at expiry, including late responses',async response=>{
  vi.useFakeTimers();
  let snapshot:ArenaSnapshot={...initial,status:'active',deadline:'2026-11-06T12:00:01Z'};
  let resolvePost!:(value:unknown)=>void;
  const post=new Promise(resolve=>{resolvePost=resolve;});
  const fetcher=vi.fn().mockImplementation((_url,options)=>options?.method==='POST' ? post : Promise.resolve({ok:true,json:async()=>snapshot}));
  vi.stubGlobal('fetch',fetcher);
  render(<Arena initial={snapshot}/>);
  const feedback=document.getElementById('submission-status')!;
  const button=screen.getByRole('button',{name:'Submit solution'});
  fireEvent.click(button);
  expect(feedback).toHaveTextContent('Sending your solution');
  const respond=async()=>{await act(async()=>{resolvePost({ok:response!=='failed',json:async()=>({status:'queued',error:'Try submitting again.'})});});};
  if(response==='acknowledged') await respond();
  await act(async()=>{await vi.advanceTimersByTimeAsync(1000);});
  expect(button).toHaveAttribute('aria-busy','false');
  expect(button).toBeDisabled();
  expect(feedback).not.toHaveClass('arena-action-pending');
  if(response!=='acknowledged') await respond();
  expect(button).toHaveAccessibleDescription(/Submissions are closed.*confirm results/);
  expect(feedback).not.toHaveTextContent(/Sending your solution|Solution queued|Try submitting again|Results settle after/);
  fireEvent.keyDown(screen.getByRole('textbox',{name:'Python solution'}),{key:'Enter',ctrlKey:true});
  expect(fetcher.mock.calls.filter(call=>call[1]?.method==='POST')).toHaveLength(1);
  snapshot={...snapshot,status:response==='failed' ? 'cancelled' : 'completed'};
  await act(async()=>{await vi.advanceTimersByTimeAsync(1000);});
  expect(document.getElementById('submission-status')).toBe(feedback);
  expect(feedback).toHaveTextContent(response==='failed' ? 'No ratings changed' : 'Results are ready');
  expect(feedback).not.toHaveTextContent('keeps checking automatically');
});
it.each([false,true])('replaces expired readiness action feedback on reopening (ready %s)',ready=>{
  render(<Arena initial={{...initial,player:{...initial.player,ready},reservationExpiresAt:initial.serverTime}}/>);
  const button=screen.getByRole('button',{name:ready ? 'Ready confirmed' : 'Ready to duel'});
  expect(button).toBeDisabled();
  expect(button).toHaveAccessibleDescription(/Readiness is closed.*server confirmation/);
  expect(button).not.toHaveAccessibleDescription(/Mark yourself ready|Waiting for the server to start/);
});
it.each(['pending','acknowledged','failed'] as const)('retires %s readiness feedback at expiry and ignores delayed responses',async response=>{
  vi.useFakeTimers();
  let snapshot:ArenaSnapshot={...initial,reservationExpiresAt:'2026-11-06T12:00:01Z'};
  let resolvePost!:(value:unknown)=>void;
  const post=new Promise(resolve=>{resolvePost=resolve;});
  const fetcher=vi.fn().mockImplementation((_url,options)=>options?.method==='POST' ? post : Promise.resolve({ok:true,json:async()=>snapshot}));
  vi.stubGlobal('fetch',fetcher);
  render(<Arena initial={snapshot}/>);
  const feedback=document.getElementById('submission-status')!;
  const button=screen.getByRole('button',{name:'Ready to duel'});
  fireEvent.click(button);
  expect(feedback).toHaveTextContent('Confirming readiness');
  const respond=async()=>{await act(async()=>{resolvePost({ok:response!=='failed',json:async()=>({status:'pending',error:'Please try readiness again.'})});});};
  if(response==='acknowledged') await respond();
  await act(async()=>{await vi.advanceTimersByTimeAsync(1000);});
  expect(button).toHaveAttribute('aria-busy','false');
  expect(button).toBeDisabled();
  expect(feedback).not.toHaveClass('arena-action-pending');
  if(response!=='acknowledged') await respond();
  expect(feedback).toHaveTextContent('Readiness is closed. Waiting for server confirmation');
  expect(feedback).not.toHaveTextContent(/Mark yourself ready|Waiting for both players|Please try readiness again/);
  fireEvent.click(button);
  expect(fetcher.mock.calls.filter(call=>call[1]?.method==='POST')).toHaveLength(1);
  snapshot={...snapshot,status:'cancelled'};
  await act(async()=>{await vi.advanceTimersByTimeAsync(1000);});
  expect(document.getElementById('submission-status')).toBe(feedback);
  expect(feedback).toHaveTextContent('No ratings changed');
  expect(feedback).not.toHaveTextContent('Readiness is closed');
});
it.each(['completed','cancelled'] as const)('keeps shortcut guidance aligned with activation, expiry and %s polling',async status=>{
  vi.useFakeTimers();
  let snapshot:ArenaSnapshot=initial;
  const fetcher=vi.fn().mockImplementation(()=>Promise.resolve({ok:true,json:async()=>snapshot}));
  vi.stubGlobal('fetch',fetcher);
  render(<Arena initial={initial}/>);
  const button=screen.getByRole('button',{name:'Submit solution'});
  expect(button).toHaveAccessibleDescription(/shortcut becomes available when the duel starts/);
  snapshot={...initial,status:'active',deadline:'2026-11-06T12:00:01Z'};
  await act(async()=>{await vi.advanceTimersByTimeAsync(0);});
  expect(button).toHaveAccessibleDescription(/Ctrl\+Enter or Command\+Enter/);
  await act(async()=>{await vi.advanceTimersByTimeAsync(1000);});
  expect(button).toHaveAccessibleDescription(/Submissions are closed while the server confirms results/);
  snapshot={...snapshot,status};
  await act(async()=>{await vi.advanceTimersByTimeAsync(1000);});
  expect(button).toHaveAccessibleDescription(/Submissions are closed. You can still copy or download/);
  expect(button).not.toHaveAccessibleDescription(/press Ctrl/);
  fireEvent.keyDown(screen.getByRole('textbox',{name:'Python solution'}),{key:'Enter',ctrlKey:true});
  expect(fetcher.mock.calls.every(call=>call[1]?.method!=='POST')).toBe(true);
});
it.each(['pending','active','completed','cancelled'] as const)('shows phase-aware shortcut guidance when reopening %s',status=>{
  render(<Arena initial={{...initial,status,deadline:status==='active' ? initial.serverTime : null}}/>);
  const button=screen.getByRole('button',{name:'Submit solution'});
  expect(button).toBeDisabled();
  expect(button).toHaveAccessibleDescription(status==='pending' ? /shortcut becomes available/ : /Submissions are closed/);
  expect(button).not.toHaveAccessibleDescription(/press Ctrl/);
});
it.each(['completed','cancelled'] as const)('updates both verified best-score descriptions after expiry and %s polling',async status=>{
  vi.useFakeTimers();
  let snapshot:ArenaSnapshot={...initial,status:'active',deadline:'2026-11-06T12:00:01Z',bestProgress:{passed:8,total:8},progress:{passed:3,total:8}};
  vi.stubGlobal('fetch',vi.fn().mockImplementation(()=>Promise.resolve({ok:true,json:async()=>snapshot})));
  render(<Arena initial={snapshot}/>);
  const bars=screen.getAllByRole('progressbar');
  for(const bar of bars) expect(bar).toHaveAccessibleDescription(/Later attempts cannot lower it/);
  await act(async()=>{await vi.advanceTimersByTimeAsync(1000);});
  for(const bar of bars) expect(bar).toHaveAccessibleDescription(/Submissions are closed.*Already submitted attempts/);
  snapshot={...snapshot,status};
  await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});
  expect(screen.getAllByRole('progressbar')).toHaveLength(2);
  for(const bar of bars) {
    expect(bar).toHaveAccessibleDescription(status==='completed' ? /View results for the recorded outcome/ : /no ratings changed/);
    expect(bar).not.toHaveAccessibleDescription(/Later attempts|confirms the result after/);
  }
  expect(bars[0]).toHaveAttribute('value','3');
  expect(bars[1]).toHaveAttribute('value','8');
});
it('announces server activation in a stable region without repeating the countdown and clears it at expiry',async()=>{
  vi.useFakeTimers();
  let snapshot:ArenaSnapshot=initial;
  vi.stubGlobal('fetch',vi.fn().mockImplementation(()=>Promise.resolve({ok:true,json:async()=>snapshot})));
  render(<Arena initial={initial}/>);
  const notice=screen.getByRole('status',{name:'Duel start'});
  expect(notice).toBeEmptyDOMElement();
  expect(notice).toHaveAttribute('aria-live','polite');
  expect(notice).toHaveAttribute('aria-atomic','true');
  snapshot={...initial,status:'active',deadline:'2026-11-06T12:05:00Z'};
  await act(async()=>{await vi.advanceTimersByTimeAsync(0);});
  expect(screen.getByRole('status',{name:'Duel start'})).toBe(notice);
  expect(notice).toHaveClass('arena-started');
  expect(notice).toHaveTextContent('Duel started. The clock is running. You can now submit');
  expect(screen.getByRole('button',{name:'Submit solution'})).toBeEnabled();
  const message=notice.textContent;
  await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});
  expect(notice.textContent).toBe(message);
  snapshot={...snapshot,serverTime:snapshot.deadline!};
  await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});
  expect(notice).toBeEmptyDOMElement();
  expect(notice).toHaveClass('sr-only');
  expect(screen.getByRole('button',{name:'Submit solution'})).toBeDisabled();
});
it('shows start guidance when reopening a running duel',()=>{
  render(<Arena initial={{...initial,status:'active',deadline:'2026-11-06T12:05:00Z'}}/>);
  expect(screen.getByRole('status',{name:'Duel start'})).toHaveTextContent('submit your latest edits before time expires');
});
it.each(['completed','cancelled'] as const)('clears start guidance after polling a %s state',async status=>{
  vi.useFakeTimers();
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({...initial,status})}));
  render(<Arena initial={{...initial,status:'active',deadline:'2026-11-06T12:05:00Z'}}/>);
  const notice=screen.getByRole('status',{name:'Duel start'});
  expect(notice).not.toBeEmptyDOMElement();
  await act(async()=>{await vi.advanceTimersByTimeAsync(0);});
  expect(notice).toBeEmptyDOMElement();
});
it.each([null,initial.serverTime])('withholds running-clock claims for deadline %s',deadline=>{
  render(<Arena initial={{...initial,status:'active',deadline}}/>);
  expect(screen.getByRole('status',{name:'Duel start'})).toBeEmptyDOMElement();
});
it('shows completed-arena guidance and an accessible results destination on reopening',()=>{
  render(<Arena initial={{...initial,status:'completed'}}/>);
  const panel=screen.getByRole('region',{name:'Duel complete. Results are ready.'});
  expect(panel).toHaveClass('arena-completed');
  expect(panel).toHaveTextContent('recorded rating changes');
  expect(panel).toHaveTextContent('copy or download');
  expect(screen.getByRole('link',{name:'View results'})).toHaveAttribute('href','/match/match/results');
  expect(screen.getByRole('status',{name:'Duel completion'})).toHaveTextContent('Duel complete. Results are ready.');
  expect(screen.getByRole('button',{name:'Submit solution'})).toBeDisabled();
});
it('announces authoritative completion once while retaining code and removing pending-results guidance',async()=>{
  vi.useFakeTimers();
  let snapshot:ArenaSnapshot={...initial,status:'active',deadline:initial.serverTime};
  const fetchMock=vi.fn().mockImplementation(()=>Promise.resolve({ok:true,json:async()=>snapshot}));
  vi.stubGlobal('fetch',fetchMock);
  render(<Arena initial={snapshot}/>);
  const announcement=screen.getByRole('status',{name:'Duel completion'});
  expect(announcement).toBeEmptyDOMElement();
  expect(announcement).toHaveAttribute('aria-live','polite');
  expect(announcement).toHaveAttribute('aria-atomic','true');
  expect(screen.getByRole('region',{name:'Time is up. Waiting for results.'})).toBeVisible();
  fireEvent.change(screen.getByLabelText('Python solution'),{target:{value:'my final code'}});
  snapshot={...snapshot,status:'completed'};
  await act(async()=>{await vi.advanceTimersByTimeAsync(0);});
  expect(screen.getByRole('status',{name:'Duel completion'})).toBe(announcement);
  expect(announcement).toHaveTextContent('View results for the outcome and recorded rating changes.');
  expect(screen.queryByRole('region',{name:'Time is up. Waiting for results.'})).not.toBeInTheDocument();
  expect(screen.getByRole('region',{name:'Duel complete. Results are ready.'})).toBeVisible();
  expect(screen.getByLabelText('Python solution')).toHaveValue('my final code');
  expect(screen.getByRole('button',{name:'Copy solution'})).toBeEnabled();
  expect(screen.getByRole('button',{name:/Download solution/})).toBeEnabled();
  await act(async()=>{await vi.advanceTimersByTimeAsync(6000);});
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
it.each(['pending','active','cancelled'] as const)('keeps completion feedback silent in a %s arena',status=>{
  render(<Arena initial={{...initial,status}}/>);
  expect(screen.getByRole('status',{name:'Duel completion'})).toBeEmptyDOMElement();
  expect(screen.queryByRole('region',{name:'Duel complete. Results are ready.'})).not.toBeInTheDocument();
});
it.each(['pending','active','completed','cancelled'] as const)('explains hidden tests and ordered scoring in the %s arena',status=>{
  render(<Arena initial={{...initial,status}}/>);
  const guide=screen.getByRole('complementary',{name:'How your solution is judged'});
  expect(guide.querySelector('details')).not.toHaveAttribute('open');
  expect(guide.querySelector('summary')).toHaveTextContent('How your solution is judged');
  expect(guide).toHaveTextContent('Matching the examples alone does not guarantee a correct solution');
  expect(Array.from(guide.querySelectorAll('ol li'),el=>el.textContent)).toEqual([
    'Most hidden tests passed.',
    'Lower median CPU time across three runs on the largest tests.',
    'Earlier submission time if correctness and CPU time tie.',
  ]);
  expect(guide).toHaveTextContent('A weaker later attempt does not replace it');
  expect(guide).toHaveTextContent('Editor changes count only after you submit them');
});
it('follows authoritative judging stages without presenting partial worker counts as a verdict',async()=>{
  vi.useFakeTimers();
  let snapshot:ArenaSnapshot={...initial,status:'active',deadline:'2026-11-06T12:05:00Z',bestProgress:{passed:4,total:8},submission:{id:'latest',status:'queued',passed:0,total:8}};
  vi.stubGlobal('fetch',vi.fn().mockImplementation(()=>Promise.resolve({ok:true,json:async()=>snapshot})));
  render(<Arena initial={snapshot}/>);
  const panel=screen.getByRole('status',{name:'Latest submission'});
  expect(panel).toHaveAttribute('aria-atomic','true');
  expect(panel).toHaveTextContent('Queued for judging');
  expect(panel).not.toHaveTextContent('0 / 8');
  fireEvent.change(screen.getByLabelText('Python solution'),{target:{value:'unsent edits'}});
  snapshot={...snapshot,submission:{id:'latest',status:'running',passed:2,total:8}};
  await act(async()=>{await vi.advanceTimersByTimeAsync(0);});
  expect(panel).toHaveTextContent('Judging in progress');
  expect(panel).not.toHaveTextContent('2 / 8');
  snapshot={...snapshot,submission:{id:'latest',status:'error',passed:2,total:8}};
  await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});
  expect(panel).toHaveTextContent('Waiting for sandbox recovery');
  expect(panel).toHaveTextContent('Your submission will retry');
  expect(panel).toHaveClass('arena-verdict--retry');
  snapshot={...snapshot,submission:{id:'latest',status:'running',passed:0,total:8}};
  await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});
  expect(panel).toHaveTextContent('Judging in progress');
  expect(panel).not.toHaveClass('arena-verdict--retry');
  snapshot={...snapshot,status:'completed',submission:{id:'latest',status:'judged',passed:3,total:8}};
  await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});
  expect(panel).toHaveTextContent('Judging complete');
  expect(panel).toHaveTextContent('Latest solution: 3 / 8 tests passed.');
  expect(screen.getByRole('progressbar',{name:'Your best tests passed: 4 / 8'})).toHaveAttribute('value','4');
  expect(screen.getByLabelText('Python solution')).toHaveValue('unsent edits');
});
it('omits the latest submission panel until a server-recorded attempt exists',()=>{
  render(<Arena initial={initial}/>);
  expect(screen.queryByRole('status',{name:'Latest submission'})).not.toBeInTheDocument();
});
it('shows authoritative best progress separately from weaker latest attempts and unsent edits',async()=>{
  vi.useFakeTimers();
  let snapshot:ArenaSnapshot={...initial,status:'active',deadline:'2026-11-06T12:05:00Z',bestProgress:null};
  vi.stubGlobal('fetch',vi.fn().mockImplementation(()=>Promise.resolve({ok:true,json:async()=>snapshot})));
  render(<Arena initial={snapshot}/>);
  const progress=screen.getByRole('region',{name:'Your best progress'});
  expect(progress).toHaveTextContent('No judged submission yet');
  expect(progress.querySelector('progress')).toBeNull();
  expect(progress).toHaveTextContent('Submit your solution when ready');
  expect(progress).not.toHaveTextContent('Best judged test count');
  snapshot={...snapshot,bestProgress:{passed:5,total:8},submission:{id:'latest',status:'judged',passed:1,total:8}};
  await act(async()=>{await vi.advanceTimersByTimeAsync(0);});
  expect(screen.getByRole('progressbar',{name:'Your best tests passed: 5 / 8'})).toHaveAttribute('max','8');
  expect(progress).toHaveTextContent('does not confirm that your current edits were submitted');
  expect(screen.getByText('Latest solution: 1 / 8 tests passed.')).toBeVisible();
  fireEvent.change(screen.getByLabelText('Python solution'),{target:{value:'unsent edits'}});
  expect(screen.getByRole('progressbar',{name:'Your best tests passed: 5 / 8'})).toHaveAttribute('value','5');
  snapshot={...snapshot,status:'completed',bestProgress:{passed:8,total:8}};
  await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});
  expect(screen.getByRole('progressbar',{name:'Your best tests passed: 8 / 8'})).toHaveAttribute('value','8');
  expect(screen.getByRole('link',{name:'View results'})).toBeVisible();
});
it('blocks invalid source, preserves export and draft recovery, and submits at the exact limit',async()=>{
  vi.useFakeTimers();
  const active={...initial,status:'active' as const,deadline:'2026-11-06T12:05:00Z'};
  const fetchMock=vi.fn().mockResolvedValue({ok:true,json:async()=>({status:'queued'})});
  vi.stubGlobal('fetch',fetchMock);
  sessionStorage.setItem('codeduel:draft:Ada:match','x'.repeat(65537));
  render(<Arena initial={active}/>);
  const submit=screen.getByRole('button',{name:'Submit solution'});
  expect(submit).toBeDisabled();
  expect(submit).toHaveAccessibleDescription(/exceeds the 65,536-character limit/);
  expect(screen.getByText(/65,537 \/ 65,536/)).toBeVisible();
  expect(screen.getByLabelText('Python solution')).toHaveValue('x'.repeat(65537));
  expect(screen.getByRole('button',{name:'Copy solution'})).toBeEnabled();
  expect(screen.getByRole('button',{name:/Download solution/})).toBeEnabled();
  fireEvent.click(submit);
  expect(fetchMock).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Python solution'),{target:{value:' \n\t'}});
  expect(submit).toBeDisabled();
  expect(submit).toHaveAccessibleDescription(/Enter a solution/);
  fireEvent.change(screen.getByLabelText('Python solution'),{target:{value:'x'.repeat(65536)}});
  expect(submit).toBeEnabled();
  expect(sessionStorage.getItem('codeduel:draft:Ada:match')).toHaveLength(65536);
  await act(async()=>{fireEvent.click(submit);});
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).source).toHaveLength(65536);
});
it('distinguishes acknowledged code from edits made during submission and resets on navigation',async()=>{
  vi.useFakeTimers();
  const active={...initial,status:'active' as const,deadline:'2026-11-06T12:05:00Z'};
  let resolve:(value:unknown)=>void=()=>{};
  vi.stubGlobal('fetch',vi.fn().mockImplementation((_url,options)=>options?.method==='POST' ? new Promise(done=>{resolve=done;}) : Promise.resolve({ok:true,json:async()=>active})));
  const view=render(<Arena initial={active}/>);
  expect(screen.getByText('Check your latest edits')).toBeVisible();
  fireEvent.change(screen.getByLabelText('Python solution'),{target:{value:'sent code'}});
  fireEvent.click(screen.getByRole('button',{name:'Submit solution'}));
  fireEvent.change(screen.getByLabelText('Python solution'),{target:{value:'new edits'}});
  await act(async()=>{resolve({ok:true,json:async()=>({status:'queued'})});});
  expect(screen.getByText('Edits not submitted')).toBeVisible();
  fireEvent.change(screen.getByLabelText('Python solution'),{target:{value:'sent code'}});
  expect(screen.getByText('Current code sent')).toBeVisible();
  fireEvent.change(screen.getByLabelText('Python solution'),{target:{value:'new edits'}});
  fireEvent.click(screen.getByRole('button',{name:'Submit solution'}));
  await act(async()=>{resolve({ok:false,json:async()=>({error:'Try again'})});});
  expect(screen.getByText('Edits not submitted')).toBeVisible();
  view.rerender(<Arena initial={{...active,id:'new-match'}}/>);
  expect(screen.getByText('Check your latest edits')).toBeVisible();
});
it('keeps unsent edit guidance honest at expiry and removes it when the match ends',async()=>{
  vi.useFakeTimers();
  let snapshot:ArenaSnapshot={...initial,status:'active',deadline:'2026-11-06T12:00:01Z'};
  vi.stubGlobal('fetch',vi.fn().mockImplementation((_url,options)=>Promise.resolve({ok:true,json:async()=>options?.method==='POST' ? {status:'queued'} : snapshot})));
  render(<Arena initial={snapshot}/>);
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Submit solution'}));});
  fireEvent.change(screen.getByLabelText('Python solution'),{target:{value:'unsent'}});
  await act(async()=>{await vi.advanceTimersByTimeAsync(1250);});
  expect(screen.getByText(/These edits differ.*Submissions are now closed/)).toBeVisible();
  expect(screen.getByRole('button',{name:'Submit solution'})).toBeDisabled();
  snapshot={...snapshot,status:'completed'};
  await act(async()=>{await vi.advanceTimersByTimeAsync(1000);});
  expect(screen.queryByText('Edits not submitted')).not.toBeInTheDocument();
});
it('explains an already cancelled reservation and links back to matchmaking',()=>{
  render(<Arena initial={{...initial,status:'cancelled'}}/>);
  expect(screen.getByRole('region',{name:'Duel cancelled'})).toBeVisible();
  expect(screen.getByRole('region',{name:'Duel cancelled'})).toHaveTextContent('No ratings changed');
  expect(screen.getByRole('status',{name:'Duel cancellation'})).toHaveTextContent('Duel cancelled. No ratings changed.');
  expect(screen.getByRole('link',{name:'Back to matchmaking'})).toHaveAttribute('href','/');
  expect(screen.queryByRole('button',{name:'Ready to duel'})).not.toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Submit solution'})).toBeDisabled();
  expect(screen.queryByRole('link',{name:'View results'})).not.toBeInTheDocument();
});
it('announces cancellation discovered by polling and retains code for export',async()=>{
  vi.useFakeTimers();
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({...initial,status:'cancelled'})}));
  render(<Arena initial={initial}/>);
  const announcement=screen.getByRole('status',{name:'Duel cancellation'});
  expect(announcement).toBeEmptyDOMElement();
  expect(announcement).toHaveAttribute('aria-live','polite');
  expect(announcement).toHaveAttribute('aria-atomic','true');
  expect(screen.queryByRole('region',{name:'Duel cancelled'})).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Python solution'),{target:{value:'def solve():\n    return 42'}});
  await act(async()=>{await vi.advanceTimersByTimeAsync(0);});
  const panel=screen.getByRole('region',{name:'Duel cancelled'});
  expect(panel.querySelector('[role="status"]')).toBeNull();
  expect(screen.getByRole('status',{name:'Duel cancellation'})).toBe(announcement);
  expect(announcement).toHaveTextContent('No ratings changed. Return home to find a new opponent.');
  expect(screen.getByLabelText('Python solution')).toHaveValue('def solve():\n    return 42');
  expect(screen.getByRole('button',{name:/Copy solution/})).toBeEnabled();
  expect(screen.getByRole('button',{name:/Download/})).toBeEnabled();
  expect(screen.queryByRole('region',{name:'Duel readiness'})).not.toBeInTheDocument();
  const message=announcement.textContent;
  await act(async()=>{await vi.advanceTimersByTimeAsync(6000);});
  expect(announcement.textContent).toBe(message);
});
it.each(['pending','active','completed'] as const)('keeps cancellation announcements silent for %s matches',status=>{
  render(<Arena initial={{...initial,status}}/>);
  expect(screen.getByRole('status',{name:'Duel cancellation'})).toBeEmptyDOMElement();
});
it('resets a recovered draft to the full starter, persists it and clears the exit warning',()=>{
  vi.stubGlobal('fetch',vi.fn());
  sessionStorage.setItem('codeduel:draft:Ada:match','recovered solution');
  render(<Arena initial={initial}/>);
  fireEvent.click(screen.getByRole('button',{name:'Reset to starter code'}));
  expect(leaveIsGuarded()).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'Replace with starter code'}));
  expect(screen.getByLabelText('Python solution')).toHaveValue('def solve():\n    pass\n');
  expect(sessionStorage.getItem('codeduel:draft:Ada:match')).toBe('def solve():\n    pass\n');
  expect(leaveIsGuarded()).toBe(false);
});
it('guards edited unfinished drafts on reload or tab close and cleans up on reset and navigation',()=>{
  vi.stubGlobal('fetch',vi.fn());
  const view=render(<Arena initial={initial}/>);
  expect(leaveIsGuarded()).toBe(false);
  fireEvent.change(screen.getByLabelText('Python solution'),{target:{value:'def solve():\n    return 42\n'}});
  expect(leaveIsGuarded()).toBe(true);
  fireEvent.change(screen.getByLabelText('Python solution'),{target:{value:'def solve():\n    pass\n'}});
  expect(leaveIsGuarded()).toBe(false);
  fireEvent.change(screen.getByLabelText('Python solution'),{target:{value:'edited'}});
  view.rerender(<Arena initial={{...initial,id:'another-match'}}/>);
  expect(leaveIsGuarded()).toBe(false);
  fireEvent.change(screen.getByLabelText('Python solution'),{target:{value:'another draft'}});
  expect(leaveIsGuarded()).toBe(true);
  view.unmount();
  expect(leaveIsGuarded()).toBe(false);
});
it.each(['completed','cancelled'])('removes the exit warning when the server reports %s',async(status)=>{
  vi.useFakeTimers();
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({...initial,status})}));
  render(<Arena initial={initial}/>);
  fireEvent.change(screen.getByLabelText('Python solution'),{target:{value:'edited'}});
  expect(leaveIsGuarded()).toBe(true);
  await act(async()=>{await vi.advanceTimersByTimeAsync(0);});
  expect(leaveIsGuarded()).toBe(false);
});
it('guards restored drafts even when browser storage stops working',()=>{
  vi.stubGlobal('fetch',vi.fn());
  sessionStorage.setItem('codeduel:draft:Ada:match','recovered code');
  vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('Storage blocked');});
  render(<Arena initial={{...initial,status:'active'}}/>);
  expect(screen.getByLabelText('Python solution')).toHaveValue('recovered code');
  expect(screen.getByText(/Draft recovery unavailable/)).toBeVisible();
  expect(leaveIsGuarded()).toBe(true);
});
it.each(['completed','cancelled'])('does not poll an initially %s arena',async(status)=>{
  vi.useFakeTimers();
  const fetcher=vi.fn();
  vi.stubGlobal('fetch',fetcher);
  vi.spyOn(document,'visibilityState','get').mockReturnValue('visible');
  render(<Arena initial={{...initial,status}}/>);
  fireEvent(document,new Event('visibilitychange'));
  await act(async()=>{await vi.advanceTimersByTimeAsync(10000);});
  expect(fetcher).not.toHaveBeenCalled();
});
it.each(['completed','cancelled'])('stops polling after observing %s and removes resume handling',async(status)=>{
  vi.useFakeTimers();
  const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({...initial,status})});
  vi.stubGlobal('fetch',fetcher);
  vi.spyOn(document,'visibilityState','get').mockReturnValue('visible');
  render(<Arena initial={initial}/>);
  await act(async()=>{await vi.advanceTimersByTimeAsync(0);});
  fireEvent(document,new Event('visibilitychange'));
  await act(async()=>{await vi.advanceTimersByTimeAsync(10000);});
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('refreshes on returning to the tab, recovers errors, and keeps only one polling chain',async()=>{
  vi.useFakeTimers();
  const visibility=vi.spyOn(document,'visibilityState','get').mockReturnValue('hidden');
  let resolve: (value:unknown)=>void=()=>{};
  const fetcher=vi.fn().mockRejectedValueOnce(new Error()).mockImplementationOnce(()=>new Promise(done=>{resolve=done;})).mockResolvedValue({ok:true,json:async()=>initial});
  vi.stubGlobal('fetch',fetcher);
  const view=render(<Arena initial={initial}/>);
  await act(async()=>{await vi.advanceTimersByTimeAsync(0);});
  expect(screen.getByRole('alert')).toBeVisible();
  fireEvent(document,new Event('visibilitychange'));
  expect(fetcher).toHaveBeenCalledTimes(1);
  visibility.mockReturnValue('visible');
  fireEvent(document,new Event('visibilitychange'));
  fireEvent(document,new Event('visibilitychange'));
  expect(fetcher).toHaveBeenCalledTimes(2);
  await act(async()=>{await vi.advanceTimersByTimeAsync(4000);});
  expect(fetcher).toHaveBeenCalledTimes(2);
  await act(async()=>{resolve({ok:true,json:async()=>initial});});
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});
  expect(fetcher).toHaveBeenCalledTimes(3);
  const signal=fetcher.mock.calls[2][1].signal as AbortSignal;
  view.unmount();
  expect(signal.aborted).toBe(true);
  fireEvent(document,new Event('visibilitychange'));
  await vi.advanceTimersByTimeAsync(10000);
  expect(fetcher).toHaveBeenCalledTimes(3);
});
it('uses server time and clamps expired deadlines',()=>{
  expect(remainingSeconds(null,initial.serverTime,0)).toBeNull();
  expect(remainingSeconds('2026-11-06T12:05:00Z',initial.serverTime,1000)).toBe(299);
  expect(remainingSeconds('2026-11-06T12:05:00Z',initial.serverTime,400000)).toBe(0);
});
it('retries stale match state immediately without overlapping automatic or manual refreshes',async()=>{
  vi.useFakeTimers();
  let resolve:(value:unknown)=>void=()=>{};
  const fetcher=vi.fn().mockRejectedValueOnce(new Error()).mockImplementationOnce(()=>new Promise(done=>{resolve=done;})).mockResolvedValue({ok:true,json:async()=>initial});
  vi.stubGlobal('fetch',fetcher);
  render(<Arena initial={initial}/>);
  fireEvent.change(screen.getByLabelText('Python solution'),{target:{value:'keep this draft'}});
  await act(async()=>{await vi.advanceTimersByTimeAsync(0);});
  const retry=screen.getByRole('button',{name:'Retry live updates'});
  fireEvent.click(retry);
  fireEvent.click(retry);
  expect(retry).toBeDisabled();
  expect(screen.getByText('Refreshing match state…')).toBeVisible();
  await act(async()=>{await vi.advanceTimersByTimeAsync(4000);});
  expect(fetcher).toHaveBeenCalledTimes(2);
  await act(async()=>{resolve({ok:true,json:async()=>({...initial,progress:{passed:4,total:8}})});});
  expect(screen.queryByRole('button',{name:'Retry live updates'})).not.toBeInTheDocument();
  expect(screen.getByRole('progressbar',{name:/Opponent best tests passed/})).toHaveAttribute('value','4');
  expect(screen.getByLabelText('Python solution')).toHaveValue('keep this draft');
  await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});
  expect(fetcher).toHaveBeenCalledTimes(3);
});
it('keeps retry available after failure and removes connection feedback when a retry observes match end',async()=>{
  vi.useFakeTimers();
  const fetcher=vi.fn().mockRejectedValue(new Error());
  vi.stubGlobal('fetch',fetcher);
  render(<Arena initial={initial}/>);
  await act(async()=>{await vi.advanceTimersByTimeAsync(0);});
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Retry live updates'}));});
  expect(screen.getByRole('button',{name:'Retry live updates'})).toBeEnabled();
  fetcher.mockResolvedValue({ok:true,json:async()=>({...initial,status:'completed'})});
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Retry live updates'}));});
  expect(screen.queryByRole('region',{name:'Live connection'})).not.toBeInTheDocument();
  expect(screen.getByRole('link',{name:'View results'})).toBeVisible();
  await act(async()=>{await vi.advanceTimersByTimeAsync(4000);});
  expect(fetcher).toHaveBeenCalledTimes(3);
});
it('shows pending state and editable drafts without implying submission works',()=>{
  vi.stubGlobal('fetch',vi.fn());
  render(<Arena initial={initial}/>);
  expect(screen.getByRole('timer')).toHaveTextContent('Waiting to start');
  expect(screen.getByRole('button',{name:'Submit solution'})).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Python solution'),{target:{value:'my draft'}});
  expect(screen.getByLabelText('Python solution')).toHaveValue('my draft');
  expect(screen.getByRole('region',{name:'Opponent progress'})).toHaveTextContent('No judged submission yet');
  expect(screen.getByRole('region',{name:'Your best progress'})).toHaveTextContent('No judged submission yet');
});
it('refreshes authoritative progress without overwriting code and reports stale updates',async()=>{
  vi.useFakeTimers();
  const fetcher=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({...initial,status:'active',deadline:'2026-11-06T12:05:00Z',progress:{passed:3,total:8}})}).mockRejectedValue(new Error());
  vi.stubGlobal('fetch',fetcher);
  const view=render(<Arena initial={initial}/>);
  fireEvent.change(screen.getByLabelText('Python solution'),{target:{value:'draft'}});
  await act(async()=>{await vi.advanceTimersByTimeAsync(0);});
  expect(screen.getByRole('timer')).toHaveTextContent('5:00');
  expect(screen.getByRole('progressbar',{name:/Opponent best tests passed/})).toHaveAttribute('value','3');
  expect(screen.getByLabelText('Python solution')).toHaveValue('draft');
  await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});
  expect(screen.getByRole('timer')).toHaveTextContent('4:58');
  expect(screen.getByRole('alert')).toHaveTextContent('Live updates unavailable');
  view.unmount();
  await vi.advanceTimersByTimeAsync(10000);
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it('locks the editor when the server reports a completed match',()=>{
  render(<Arena initial={{...initial,status:'completed'}}/>);
  expect(screen.getByLabelText('Python solution')).toHaveAttribute('readonly');
  expect(screen.getByText('This match has ended.')).toBeInTheDocument();
  expect(screen.getByRole('link',{name:'View results'})).toHaveAttribute('href',`/match/${initial.id}/results`);
});
it.each(['advanced','plain'])('submits the %s editor draft and reports authoritative judging results and errors',async(mode)=>{
  vi.useFakeTimers();
  const active={...initial,status:'active',deadline:'2026-11-06T12:05:00Z'};
  const fetcher=vi.fn().mockImplementation(async(_url,options)=> options?.method==='POST' ? {ok:true,json:async()=>({status:'queued'})} : {ok:true,json:async()=>({...active,submission:{status:'judged',passed:1,total:8}})});
  vi.stubGlobal('fetch',fetcher);
  render(<Arena initial={active}/>);
  if (mode==='plain') fireEvent.click(screen.getByRole('button',{name:'Use plain text editor'}));
  fireEvent.change(screen.getByLabelText('Python solution'),{target:{value:'my solution'}});
  fireEvent.click(screen.getByRole('button',{name:'Submit solution'}));
  await act(async()=>{await Promise.resolve();});
  expect(fetcher).toHaveBeenCalledWith('/api/matches/match',expect.objectContaining({method:'POST',body:JSON.stringify({action:'submit',source:'my solution'})}));
  expect(screen.getByText(/Solution queued/)).toBeInTheDocument();
  await act(async()=>{await vi.advanceTimersByTimeAsync(0);});
  expect(screen.getByText('Latest solution: 1 / 8 tests passed.')).toBeInTheDocument();
  fetcher.mockResolvedValueOnce({ok:false,json:async()=>({error:'Wait for judging.'})});
  fireEvent.click(screen.getByRole('button',{name:'Submit solution'}));
  await act(async()=>{await Promise.resolve();});
  expect(screen.getByText('Wait for judging.')).toBeInTheDocument();
});
it('sends explicit readiness and keeps submission disabled during reservations',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>initial}));
  render(<Arena initial={initial}/>);
  fireEvent.click(screen.getByRole('button',{name:'Ready to duel'}));
  await act(async()=>{await Promise.resolve();});
  expect(screen.getByText(/Ready. Waiting for both players/)).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Submit solution'})).toBeDisabled();
});
it('restores participant readiness and removes the waiting panel when the duel starts',async()=>{
  vi.useFakeTimers();
  const reserved={...initial,player:{...initial.player,ready:true},opponent:{...initial.opponent,ready:false}};
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({...reserved,status:'active',deadline:'2026-11-06T12:05:00Z'})}));
  render(<Arena initial={reserved}/>);
  expect(screen.getByText('You: Ready')).toBeVisible();
  expect(screen.getByText('Opponent: Not ready')).toBeVisible();
  expect(screen.getByRole('button',{name:'Ready confirmed'})).toBeDisabled();
  await act(async()=>{await vi.advanceTimersByTimeAsync(0);});
  expect(screen.queryByRole('status',{name:'Duel readiness'})).not.toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Submit solution'})).toBeEnabled();
});
it('keeps confirmed readiness through an older poll without sending duplicate ready actions',async()=>{
  vi.useFakeTimers();
  const fetcher=vi.fn().mockImplementation((_url,options)=>Promise.resolve({ok:true,json:async()=>options?.method==='POST' ? {status:'pending'} : initial}));
  vi.stubGlobal('fetch',fetcher);
  render(<Arena initial={{...initial,opponent:{...initial.opponent,ready:true}}}/>);
  expect(screen.getByText('Opponent: Ready')).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'Ready to duel'}));
  await act(async()=>{await Promise.resolve();});
  await act(async()=>{await vi.advanceTimersByTimeAsync(0);});
  const ready=screen.getByRole('button',{name:'Ready confirmed'});
  expect(ready).toBeDisabled();
  fireEvent.click(ready);
  expect(fetcher.mock.calls.filter(call=>call[1]?.method==='POST')).toHaveLength(1);
  expect(screen.getByText('You: Ready')).toBeVisible();
});
it('recovers the exact draft after remount, including an intentionally empty editor',()=>{
  const first=render(<Arena initial={initial}/>);
  fireEvent.change(screen.getByLabelText('Python solution'),{target:{value:'def solve():\n    return 42'}});
  first.unmount();
  const second=render(<Arena initial={initial}/>);
  expect(screen.getByLabelText('Python solution')).toHaveValue('def solve():\n    return 42');
  expect(screen.getByText(/Draft saved in this tab/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Python solution'),{target:{value:''}});
  second.unmount();
  render(<Arena initial={initial}/>);
  expect(screen.getByLabelText('Python solution')).toHaveValue('');
});
it('isolates drafts between matches and players when navigating',()=>{
  const view=render(<Arena initial={initial}/>);
  fireEvent.change(screen.getByLabelText('Python solution'),{target:{value:'private draft'}});
  view.rerender(<Arena initial={{...initial,id:'another-match'}}/>);
  expect(screen.getByLabelText('Python solution')).toHaveValue('def solve():\n    pass\n');
  view.rerender(<Arena initial={{...initial,player:{username:'Carol',rating:800}}}/>);
  expect(screen.getByLabelText('Python solution')).toHaveValue('def solve():\n    pass\n');
  view.rerender(<Arena initial={initial}/>);
  expect(screen.getByLabelText('Python solution')).toHaveValue('private draft');
});
it.each(['completed','cancelled'])('clears recovery when the server reports %s',async(status)=>{
  vi.useFakeTimers();
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({...initial,status})}));
  render(<Arena initial={initial}/>);
  fireEvent.change(screen.getByLabelText('Python solution'),{target:{value:'draft'}});
  expect(sessionStorage.length).toBe(1);
  await act(async()=>{await vi.advanceTimersByTimeAsync(0);});
  expect(sessionStorage.length).toBe(0);
  expect(screen.getByLabelText('Python solution')).toHaveValue('draft');
  expect(screen.getByLabelText('Python solution')).toHaveAttribute('readonly');
});
it('keeps editing and submission working when browser storage is unavailable',async()=>{
  vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw new Error('blocked');});
  vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('quota');});
  const fetcher=vi.fn().mockImplementation(async(_url,options)=>({ok:true,json:async()=>options?.method==='POST' ? {status:'queued'} : {...initial,status:'active',deadline:'2026-11-06T12:05:00Z'}}));
  vi.stubGlobal('fetch',fetcher);
  render(<Arena initial={{...initial,status:'active',deadline:'2026-11-06T12:05:00Z'}}/>);
  fireEvent.change(screen.getByLabelText('Python solution'),{target:{value:'still editable'}});
  expect(screen.getByText(/Draft recovery unavailable/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Submit solution'}));
  await act(async()=>{await Promise.resolve();});
  expect(fetcher).toHaveBeenCalledWith('/api/matches/match',expect.objectContaining({body:JSON.stringify({action:'submit',source:'still editable'})}));
});

it.each([
  {passed:null,total:8}, {passed:0,total:null}, {passed:0,total:0},
  {passed:-1,total:8}, {passed:9,total:8}, {passed:1.5,total:8},
  {passed:1,total:8.5}, {passed:NaN,total:8}, {passed:1,total:Infinity},
])('withholds sound and visual verdicts for invalid scores and announces a corrected attempt once: %j',async(score)=>{
  vi.useFakeTimers();
  const play=vi.spyOn(DuelSound.prototype,'play').mockImplementation(()=>{});
  vi.spyOn(DuelSound.prototype,'unlock').mockImplementation(()=>{});
  let submission:ArenaSnapshot['submission']={id:'new',status:'judged',...score};
  vi.stubGlobal('fetch',vi.fn().mockImplementation(async()=>({ok:true,json:async()=>({...initial,submission})})));
  render(<Arena initial={initial}/>);
  fireEvent.click(screen.getByRole('button',{name:'Sound off'}));
  const preview=screen.getByText('Test passed');
  play.mockClear();
  await act(async()=>{await vi.advanceTimersByTimeAsync(0);});
  expect(play).not.toHaveBeenCalled();
  expect(screen.getByText('Test passed')).toBe(preview);
  expect(screen.queryByText('Test failed')).not.toBeInTheDocument();
  expect(screen.getByRole('status',{name:'Latest submission'})).toHaveTextContent('score is unavailable');
  submission={id:'new',status:'judged',passed:0,total:8};
  await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});
  expect(play).toHaveBeenCalledExactlyOnceWith('failed');
  expect(screen.getByText('Test failed')).toBeVisible();
  await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});
  expect(play).toHaveBeenCalledTimes(1);
});

it.each([
  {passed:null,total:8}, {passed:0,total:null}, {passed:0,total:0},
  {passed:-1,total:8}, {passed:9,total:8}, {passed:1.5,total:8},
  {passed:1,total:8.5}, {passed:NaN,total:8}, {passed:1,total:Infinity},
])('recovers an unavailable initial verdict once after reopening: %j',async(score)=>{
  vi.useFakeTimers();
  const play=vi.spyOn(DuelSound.prototype,'play').mockImplementation(()=>{});
  vi.spyOn(DuelSound.prototype,'unlock').mockImplementation(()=>{});
  let submission:ArenaSnapshot['submission']={id:'reopened',status:'judged',...score};
  vi.stubGlobal('fetch',vi.fn().mockImplementation(async()=>({ok:true,json:async()=>({...initial,submission})})));
  render(<Arena initial={{...initial,submission}}/>);
  expect(screen.getByRole('status',{name:'Latest submission'})).toHaveTextContent('score is unavailable');
  expect(screen.queryByText('Test failed')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Sound off'}));
  play.mockClear();
  await act(async()=>{await vi.advanceTimersByTimeAsync(0);});
  expect(play).not.toHaveBeenCalled();
  submission={id:'reopened',status:'judged',passed:0,total:8};
  await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});
  expect(play).toHaveBeenCalledExactlyOnceWith('failed');
  expect(screen.getByText('Test failed')).toBeVisible();
  submission={id:'reopened',status:'judged',...score};
  await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});
  submission={id:'reopened',status:'judged',passed:8,total:8};
  await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});
  expect(play).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('status',{name:'Latest submission'})).toHaveTextContent('All tests passed');
});

it('announces each newly judged submission once, including identical scores, without replaying history',async()=>{
  vi.useFakeTimers();
  const play=vi.spyOn(DuelSound.prototype,'play').mockImplementation(()=>{});
  vi.spyOn(DuelSound.prototype,'unlock').mockImplementation(()=>{});
  const active={...initial,status:'active',deadline:'2026-11-06T12:05:00Z'};
  let submission={id:'old',status:'judged',passed:8,total:8};
  vi.stubGlobal('fetch',vi.fn().mockImplementation(async()=>({ok:true,json:async()=>({...active,submission:{...submission}})})));
  render(<Arena initial={{...active,submission}}/>);
  expect(screen.queryByText('Test passed')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Sound off'}));
  play.mockClear();
  await act(async()=>{await vi.advanceTimersByTimeAsync(0);});
  expect(play).not.toHaveBeenCalled();
  submission={id:'new',status:'running',passed:0,total:8};
  await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});
  expect(play).not.toHaveBeenCalled();
  submission={...submission,status:'error'};
  await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});
  expect(play).not.toHaveBeenCalled();
  submission={...submission,status:'judged',passed:3};
  await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});
  expect(screen.getByText('Test failed')).toBeVisible();
  expect(play).toHaveBeenCalledExactlyOnceWith('failed');
  await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});
  expect(play).toHaveBeenCalledTimes(1);
  submission={...submission,id:'another'};
  await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});
  expect(play).toHaveBeenCalledTimes(2);
  submission={...submission,id:'perfect',passed:8};
  await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});
  expect(screen.getByText('Test passed')).toBeVisible();
  expect(play).toHaveBeenLastCalledWith('passed');
  fireEvent.click(screen.getByRole('button',{name:'Sound on'}));
  submission={...submission,id:'muted',passed:0};
  await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});
  expect(screen.getByText('Test failed')).toBeVisible();
  expect(play).toHaveBeenCalledTimes(3);
});

it.each(['ready','submit'])('isolates pending %s requests on navigation and allows a fresh action',async(action)=>{
  vi.useFakeTimers();
  let finish:(value:unknown)=>void=()=>{};
  const fetcher=vi.fn().mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
  vi.stubGlobal('fetch',fetcher);
  const snapshot=action==='ready' ? initial : {...initial,status:'active',deadline:'2026-11-06T12:05:00Z'};
  const label=action==='ready' ? 'Ready to duel' : 'Submit solution';
  const view=render(<Arena initial={snapshot}/>);
  const button=screen.getByRole('button',{name:label});
  act(()=>{button.click();button.click();});
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(button).toBeDisabled();
  const signal=fetcher.mock.calls[0][1].signal as AbortSignal;
  view.rerender(<Arena initial={{...snapshot,id:'replacement'}}/>);
  expect(signal.aborted).toBe(true);
  await act(async()=>{finish({ok:true,json:async()=>({})});});
  expect(screen.queryByText(/Solution queued|Ready. Waiting for both players/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:label}));
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls[1][0]).toBe('/api/matches/replacement');
  const replacementSignal=fetcher.mock.calls[1][1].signal as AbortSignal;
  view.unmount();
  expect(replacementSignal.aborted).toBe(true);
  await act(async()=>{finish({ok:true,json:async()=>({})});});
});

it('allows an arena action to retry after a network failure',async()=>{
  vi.useFakeTimers();
  const fetcher=vi.fn().mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValue({ok:true,json:async()=>({})});
  vi.stubGlobal('fetch',fetcher);
  render(<Arena initial={initial}/>);
  fireEvent.click(screen.getByRole('button',{name:'Ready to duel'}));
  await act(async()=>{await Promise.resolve();});
  expect(screen.getByText('Connection lost')).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Ready to duel'})).toBeEnabled();
  fireEvent.click(screen.getByRole('button',{name:'Ready to duel'}));
  await act(async()=>{await Promise.resolve();});
  expect(screen.getByText(/Ready. Waiting for both players/)).toBeInTheDocument();
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it('announces local clock expiry, preserves export and waits for authoritative completion',async()=>{
  vi.useFakeTimers();
  const active:ArenaSnapshot={...initial,status:'active',deadline:'2026-11-06T12:00:01Z'};
  const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>active});
  vi.stubGlobal('fetch',fetcher);
  render(<Arena initial={active}/>);
  const settlement=screen.getByRole('status',{name:'Duel settlement'});
  expect(settlement).toBeEmptyDOMElement();
  expect(settlement).toHaveAttribute('aria-live','polite');
  expect(settlement).toHaveAttribute('aria-atomic','true');
  fireEvent.change(screen.getByLabelText('Python solution'),{target:{value:'my solution'}});
  expect(screen.queryByRole('region',{name:'Time is up. Waiting for results.'})).not.toBeInTheDocument();
  await act(async()=>{await vi.advanceTimersByTimeAsync(1000);});
  const panel=screen.getByRole('region',{name:'Time is up. Waiting for results.'});
  expect(panel.querySelector('[role="status"]')).toBeNull();
  expect(screen.getByRole('status',{name:'Duel settlement'})).toBe(settlement);
  expect(settlement).toHaveTextContent('Submissions are closed. Waiting for the server');
  expect(settlement).toHaveTextContent('copy or download your code');
  const announcement=settlement.textContent;
  expect(screen.getByRole('button',{name:'Submit solution'})).toBeDisabled();
  expect(screen.getByRole('button',{name:'Copy solution'})).toBeEnabled();
  expect(screen.getByRole('button',{name:/Download solution/})).toBeEnabled();
  expect(screen.getByLabelText('Python solution')).toHaveValue('my solution');
  expect(screen.queryByRole('link',{name:'View results'})).not.toBeInTheDocument();
  fetcher.mockRejectedValueOnce(new Error('offline'));
  await act(async()=>{await vi.advanceTimersByTimeAsync(1000);});
  expect(panel).toBeVisible();
  expect(settlement.textContent).toBe(announcement);
  expect(screen.getByRole('button',{name:'Retry live updates'})).toBeEnabled();
  fetcher.mockResolvedValue({ok:true,json:async()=>({...active,status:'completed'})});
  await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});
  expect(screen.queryByRole('region',{name:'Time is up. Waiting for results.'})).not.toBeInTheDocument();
  expect(screen.getByRole('link',{name:'View results'})).toBeVisible();
  expect(settlement).toBeEmptyDOMElement();
});

it('shows settlement guidance when reopening an expired active match',()=>{
  vi.useFakeTimers();
  vi.stubGlobal('fetch',vi.fn());
  render(<Arena initial={{...initial,status:'active',deadline:initial.serverTime}}/>);
  expect(screen.getByRole('region',{name:'Time is up. Waiting for results.'})).toBeVisible();
  expect(screen.getByRole('button',{name:'Submit solution'})).toBeDisabled();
  expect(screen.getByRole('status',{name:'Duel settlement'})).toHaveTextContent('Time is up. Submissions are closed.');
});

it.each([
  {...initial},
  {...initial,status:'active' as const,deadline:null},
  {...initial,status:'active' as const,deadline:'2026-11-06T12:05:00Z'},
  {...initial,status:'completed' as const,deadline:initial.serverTime},
  {...initial,status:'cancelled' as const,deadline:initial.serverTime},
])('keeps settlement announcements silent outside expired active matches: %j',snapshot=>{
  render(<Arena initial={snapshot}/>);
  expect(screen.getByRole('status',{name:'Duel settlement'})).toBeEmptyDOMElement();
});

it('clears settlement feedback when polling confirms cancellation',async()=>{
  vi.useFakeTimers();
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({...initial,status:'cancelled'})}));
  render(<Arena initial={{...initial,status:'active',deadline:initial.serverTime}}/>);
  const notice=screen.getByRole('status',{name:'Duel settlement'});
  expect(notice).not.toBeEmptyDOMElement();
  await act(async()=>{await vi.advanceTimersByTimeAsync(0);});
  expect(screen.getByRole('status',{name:'Duel settlement'})).toBe(notice);
  expect(notice).toBeEmptyDOMElement();
});

it.each(['pending','active','completed','cancelled'] as const)('withholds readiness-expiry announcements without an expired pending reservation (%s)',status=>{
  render(<Arena initial={{...initial,status,reservationExpiresAt:status==='pending' ? null : initial.serverTime}}/>);
  expect(screen.getByRole('status',{name:'Readiness expiry'})).toBeEmptyDOMElement();
});

it('keeps reopened readiness-expiry feedback stable during polling outages',async()=>{
  vi.useFakeTimers();
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('offline')));
  render(<Arena initial={{...initial,reservationExpiresAt:initial.serverTime}}/>);
  const notice=screen.getByRole('status',{name:'Readiness expiry'});
  const message=notice.firstChild;
  expect(notice).toHaveTextContent('no result or rating change is confirmed');
  await act(async()=>{await vi.advanceTimersByTimeAsync(4000);});
  expect(screen.getByRole('status',{name:'Readiness expiry'})).toBe(notice);
  expect(notice.firstChild).toBe(message);
  expect(screen.getByRole('button',{name:'Ready to duel'})).toBeDisabled();
  expect(screen.getByRole('button',{name:'Copy solution'})).toBeEnabled();
});

it('counts down the server reservation window and awaits authoritative cancellation at zero',async()=>{
  vi.useFakeTimers();
  let snapshot:ArenaSnapshot={...initial,reservationExpiresAt:'2026-11-06T12:00:02Z'};
  vi.stubGlobal('fetch',vi.fn().mockImplementation(()=>Promise.resolve({ok:true,json:async()=>snapshot})));
  render(<Arena initial={snapshot}/>);
  expect(screen.getByRole('timer')).toHaveTextContent('Ready in 2s');
  const expiry=screen.getByRole('status',{name:'Readiness expiry'});
  expect(expiry).toBeEmptyDOMElement();
  expect(expiry).toHaveAttribute('aria-live','polite');
  expect(expiry).toHaveAttribute('aria-atomic','true');
  fireEvent.change(screen.getByLabelText('Python solution'),{target:{value:'preserved code'}});
  await act(async()=>{await vi.advanceTimersByTimeAsync(1750);});
  expect(screen.getByRole('timer')).toHaveTextContent('Ready in 1s');
  // A failed refresh must not reset or extend the readiness window.
  vi.mocked(fetch).mockRejectedValueOnce(new Error('offline'));
  await act(async()=>{await vi.advanceTimersByTimeAsync(500);});
  expect(screen.getByRole('timer')).toHaveTextContent('Confirming status');
  expect(screen.getByText(/The readiness window has ended/)).toBeVisible();
  expect(screen.getByRole('status',{name:'Readiness expiry'})).toBe(expiry);
  expect(expiry).toHaveTextContent('Waiting for server confirmation of activation or cancellation');
  expect(screen.getByRole('status',{name:'Duel readiness'})).toHaveAttribute('aria-live','off');
  expect(screen.getByRole('button',{name:'Ready to duel'})).toBeDisabled();
  expect(screen.queryByRole('region',{name:'Duel cancelled'})).not.toBeInTheDocument();
  expect(screen.getByLabelText('Python solution')).toHaveValue('preserved code');
  snapshot={...snapshot,status:'cancelled'};
  await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});
  expect(screen.getByRole('region',{name:'Duel cancelled'})).toBeVisible();
  expect(expiry).toBeEmptyDOMElement();
  expect(screen.queryByText(/The readiness window has ended/)).not.toBeInTheDocument();
});

it('replaces the reservation clock with the active match clock after server activation',async()=>{
  vi.useFakeTimers();
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({...initial,status:'active',deadline:'2026-11-06T12:05:00Z',reservationExpiresAt:null})}));
  render(<Arena initial={{...initial,reservationExpiresAt:'2026-11-06T11:59:59Z'}}/>);
  expect(screen.getByRole('timer')).toHaveTextContent('Confirming status');
  const expiry=screen.getByRole('status',{name:'Readiness expiry'});
  expect(expiry).toHaveTextContent('Time to mark ready has expired');
  await act(async()=>{await vi.advanceTimersByTimeAsync(0);});
  expect(screen.getByRole('timer')).toHaveTextContent('5:00');
  expect(screen.getByRole('status',{name:'Readiness expiry'})).toBe(expiry);
  expect(expiry).toBeEmptyDOMElement();
  expect(screen.queryByRole('region',{name:'Duel readiness'})).not.toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Submit solution'})).toBeEnabled();
});

it('labels opponent progress as best judged correctness and explains scoring ties',()=>{
  vi.stubGlobal('fetch',vi.fn().mockReturnValue(new Promise(()=>{})));
  const view=render(<Arena initial={initial}/>);
  expect(screen.getByRole('region',{name:'Opponent progress'})).toHaveTextContent('No judged submission yet');
  expect(screen.queryByRole('progressbar')).toBeNull();
  view.rerender(<Arena initial={{...initial,id:'scored',progress:{passed:5,total:8}}}/>);
  const progress=screen.getByRole('progressbar',{name:'Opponent best tests passed: 5 / 8'});
  expect(progress).toHaveAttribute('value','5');
  expect(progress).toHaveAttribute('max','8');
  expect(progress).toHaveAccessibleDescription('Best judged test count. Later attempts cannot lower it; runtime and submission time break ties.');
});

it('submits current code with editor shortcuts in both editors and guards duplicate or modified keys',async()=>{
  vi.useFakeTimers();
  let resolve:(value:unknown)=>void=()=>{};
  const fetchMock=vi.fn().mockImplementation(()=>new Promise(done=>{resolve=done;}));
  vi.stubGlobal('fetch',fetchMock);
  render(<Arena initial={{...initial,status:'active',deadline:'2026-11-06T12:05:00Z'}}/>);
  const submit=screen.getByRole('button',{name:'Submit solution'});
  expect(submit).toHaveAttribute('aria-keyshortcuts','Control+Enter Meta+Enter');
  expect(submit).toHaveAccessibleDescription(/Ctrl\+Enter/);
  const editor=screen.getByLabelText('Python solution');
  fireEvent.change(editor,{target:{value:'def solve():\n    return 42'}});
  for (const modifiers of [{},{ctrlKey:true,shiftKey:true},{metaKey:true,altKey:true},{ctrlKey:true,repeat:true},{ctrlKey:true,isComposing:true}]) {
    fireEvent.keyDown(editor,{key:'Enter',...modifiers});
  }
  fireEvent.keyDown(submit,{key:'Enter',ctrlKey:true});
  expect(fetchMock).not.toHaveBeenCalled();
  fireEvent.keyDown(editor,{key:'Enter',ctrlKey:true});
  fireEvent.keyDown(editor,{key:'Enter',metaKey:true});
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).source).toBe('def solve():\n    return 42');
  await act(async()=>{resolve({ok:true,json:async()=>({status:'queued'})});});
  fireEvent.click(screen.getByRole('button',{name:'Use plain text editor'}));
  fireEvent.keyDown(screen.getByLabelText('Python solution'),{key:'Enter',metaKey:true});
  expect(fetchMock).toHaveBeenCalledTimes(2);
  await act(async()=>{resolve({ok:true,json:async()=>({status:'queued'})});});
});
it.each(['pending','completed','cancelled','expired','blank','oversized'])('does not submit through shortcuts when %s',state=>{
  vi.useFakeTimers();
  const fetchMock=vi.fn();
  vi.stubGlobal('fetch',fetchMock);
  const status=state==='pending' || state==='completed' || state==='cancelled' ? state : 'active';
  render(<Arena initial={{...initial,status,deadline:state==='expired' ? initial.serverTime : '2026-11-06T12:05:00Z'}}/>);
  const editor=screen.getByLabelText('Python solution');
  if (state==='blank' || state==='oversized') fireEvent.change(editor,{target:{value:state==='blank' ? '  ' : 'x'.repeat(65537)}});
  fireEvent.keyDown(editor,{key:'Enter',ctrlKey:true});
  fireEvent.keyDown(editor,{key:'Enter',metaKey:true});
  expect(fetchMock).not.toHaveBeenCalled();
});

it('warns at the final-minute boundary with stable accessible text and preserves edits through expiry',async()=>{
  vi.useFakeTimers();
  vi.stubGlobal('fetch',vi.fn().mockReturnValue(new Promise(()=>{})));
  render(<Arena initial={{...initial,status:'active',deadline:'2026-11-06T12:01:01Z'}}/>);
  const timer=screen.getByRole('timer');
  expect(timer).toHaveTextContent('1:01');
  expect(screen.queryByText(/Final minute\./)).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Python solution'),{target:{value:'my latest edits'}});
  await act(async()=>{await vi.advanceTimersByTimeAsync(1000);});
  const warning=screen.getByText(/Final minute\./);
  expect(warning).toHaveAttribute('role','status');
  expect(warning).toHaveAttribute('aria-atomic','true');
  expect(timer.parentElement).toHaveClass('arena-clock--urgent');
  expect(screen.getByRole('button',{name:'Submit solution'})).toBeEnabled();
  await act(async()=>{await vi.advanceTimersByTimeAsync(1000);});
  expect(timer).toHaveTextContent('0:59');
  expect(screen.getByText(/Final minute\./)).toBe(warning);
  expect(warning).toHaveTextContent('Final minute. Submit your latest edits before the clock expires.');
  await act(async()=>{await vi.advanceTimersByTimeAsync(59000);});
  expect(screen.queryByText(/Final minute\./)).not.toBeInTheDocument();
  expect(timer.parentElement).not.toHaveClass('arena-clock--urgent');
  expect(screen.getByRole('button',{name:'Submit solution'})).toBeDisabled();
  expect(screen.getByLabelText('Python solution')).toHaveValue('my latest edits');
  expect(screen.getByText('Time is up. Waiting for results.')).toBeVisible();
});
it.each(['pending','completed','cancelled'] as const)('does not show an active-clock warning for %s matches',status=>{
  vi.useFakeTimers();
  vi.stubGlobal('fetch',vi.fn().mockReturnValue(new Promise(()=>{})));
  render(<Arena initial={{...initial,status,deadline:'2026-11-06T12:00:30Z'}}/>);
  expect(screen.queryByText(/Final minute\./)).not.toBeInTheDocument();
  expect(screen.getByRole('timer').parentElement).not.toHaveClass('arena-clock--urgent');
});
it('follows authoritative clock corrections and clears the warning when results arrive',async()=>{
  vi.useFakeTimers();
  let snapshot:ArenaSnapshot={...initial,status:'active',deadline:'2026-11-06T12:00:30Z'};
  vi.stubGlobal('fetch',vi.fn().mockImplementation(()=>Promise.resolve({ok:true,json:async()=>snapshot})));
  render(<Arena initial={snapshot}/>);
  expect(screen.getByText(/Final minute\./)).toBeVisible();
  snapshot={...snapshot,deadline:'2026-11-06T12:05:00Z'};
  await act(async()=>{await vi.advanceTimersByTimeAsync(0);});
  expect(screen.queryByText(/Final minute\./)).not.toBeInTheDocument();
  snapshot={...snapshot,deadline:'2026-11-06T12:00:30Z'};
  await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});
  expect(screen.getByText(/Final minute\./)).toBeVisible();
  snapshot={...snapshot,status:'completed'};
  await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});
  expect(screen.queryByText(/Final minute\./)).not.toBeInTheDocument();
  expect(screen.getByRole('link',{name:'View results'})).toBeVisible();
});

it.each(['ready','submit'] as const)('shows pending %s acknowledgement, preserves edits and recovers after failure',async(action)=>{
  vi.useFakeTimers();
  const snapshot=action==='ready' ? initial : {...initial,status:'active',deadline:'2026-11-06T12:05:00Z'};
  let resolve:(value:unknown)=>void=()=>{};
  const fetcher=vi.fn().mockImplementation((_url,options)=>options?.method==='POST' ? new Promise(done=>{resolve=done;}) : Promise.resolve({ok:true,json:async()=>snapshot}));
  vi.stubGlobal('fetch',fetcher);
  render(<Arena initial={snapshot}/>);
  const button=screen.getByRole('button',{name:action==='ready' ? 'Ready to duel' : 'Submit solution'});
  fireEvent.click(button);
  expect(button).toBeDisabled();
  expect(button).toHaveAttribute('aria-busy','true');
  const status=document.getElementById('submission-status')!;
  expect(status).toHaveAttribute('aria-atomic','true');
  expect(status).toHaveClass('arena-action-pending');
  expect(status).toHaveTextContent(action==='ready' ? 'Confirming readiness with the server' : 'Sending your solution');
  if(action==='submit') expect(status).toHaveTextContent('edits made now are not included');
  fireEvent.change(screen.getByLabelText('Python solution'),{target:{value:'new unsent edits'}});
  fireEvent.click(button);
  await act(async()=>{await vi.advanceTimersByTimeAsync(0);});
  expect(fetcher.mock.calls.filter(call=>call[1]?.method==='POST')).toHaveLength(1);
  expect(status).toHaveClass('arena-action-pending');
  await act(async()=>{resolve({ok:false,json:async()=>({error:'Please retry.'})});});
  expect(status).toHaveTextContent('Please retry.');
  expect(status).not.toHaveClass('arena-action-pending');
  expect(button).toHaveAttribute('aria-busy','false');
  expect(button).toBeEnabled();
  expect(screen.getByLabelText('Python solution')).toHaveValue('new unsent edits');
  fireEvent.click(button);
  await act(async()=>{resolve({ok:true,json:async()=>({status:action==='ready' ? 'pending' : 'queued'})});});
  expect(status).toHaveTextContent(action==='ready' ? 'Ready. Waiting for both players' : 'Solution queued.');
  expect(button).toHaveAttribute('aria-busy','false');
  expect(status).not.toHaveClass('arena-action-pending');
});

it('provides named arena navigation and focusable jump destinations after match end',()=>{
  render(<Arena initial={{...initial,status:'completed'}}/>);
  expect(screen.getByRole('link',{name:'Skip to duel'})).toHaveAttribute('href','#main-content');
  expect(screen.getByRole('main')).toHaveAttribute('tabindex','-1');
  const navigation=screen.getByRole('navigation',{name:'Arena sections'});
  expect(navigation).toHaveTextContent('Read problem');
  expect(screen.getByRole('link',{name:'Read problem'})).toHaveAttribute('href','#arena-problem-title');
  expect(screen.getByRole('link',{name:'Back to your solution'})).toHaveAttribute('href','#arena-solution-title');
  expect(screen.getByRole('heading',{name:'Sample'})).toHaveAttribute('tabindex','-1');
  expect(screen.getByRole('heading',{name:'Your solution'})).toHaveAttribute('tabindex','-1');
});

it.each(['pending','active','completed','cancelled'] as const)('preserves constraints and offers optional complexity guidance in the %s arena',status=>{
  render(<Arena initial={{...initial,status,problem:{...initial.problem,constraints:'1 <= n <= 100,000\nValues may be negative.'}}}/>);
  const constraints=screen.getByRole('region',{name:'Constraints'});
  expect(constraints.querySelector('.arena-text')?.textContent).toBe('1 <= n <= 100,000\nValues may be negative.');
  const details=constraints.querySelector('details')!;
  expect(details).not.toHaveAttribute('open');
  expect(details.querySelector('summary')).toHaveTextContent('Use input limits to plan your solution');
  expect(details).toHaveTextContent('about 5 billion comparisons');
  expect(details).toHaveTextContent('not a required approach or a guarantee');
});

it.each(['pending','active','completed','cancelled'] as const)('preserves the function contract and explains signature scrolling in the %s arena',status=>{
  const signature='def solve(\n    values: list[int],\n) -> int:';
  render(<Arena initial={{...initial,status,problem:{...initial.problem,signature}}}/>);
  const region=screen.getByRole('region',{name:'Function signature'});
  expect(region).toHaveAttribute('tabindex','0');
  expect(region).toHaveAccessibleDescription('Keep this function name and parameters in your solution. Long signatures scroll sideways; focus the code and use the arrow keys, or swipe.');
  expect(region.querySelector('code')?.textContent).toBe(signature);
});

it.each(['pending','active','completed','cancelled'] as const)('announces recovery into %s only after a failed update',async(status)=>{
  vi.useFakeTimers();
  const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>initial});
  vi.stubGlobal('fetch',fetcher);
  render(<Arena initial={initial}/>);
  const recovery=screen.getByRole('status',{name:'Live update recovery'});
  expect(recovery).toBeEmptyDOMElement();
  expect(recovery).toHaveAttribute('aria-live','polite');
  expect(recovery).toHaveAttribute('aria-atomic','true');
  await act(async()=>{await vi.advanceTimersByTimeAsync(0);});
  expect(recovery).toBeEmptyDOMElement();
  fetcher.mockRejectedValue(new Error('offline'));
  await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});
  expect(screen.getByRole('alert')).toHaveTextContent('Live updates unavailable');
  expect(recovery).toBeEmptyDOMElement();
  await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});
  expect(recovery).toBeEmptyDOMElement();
  fetcher.mockResolvedValue({ok:true,json:async()=>({...initial,status})});
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Retry live updates'}));});
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('status',{name:'Live update recovery'})).toBe(recovery);
  expect(recovery).toHaveTextContent('Live updates restored. Match status and progress refreshed from the server.');
  expect(recovery).toHaveClass('arena-connection-recovered');
  await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});
  expect(recovery).toHaveTextContent('Live updates restored.');
  if (status==='pending' || status==='active') {
    fetcher.mockResolvedValue({ok:false});
    await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});
    expect(recovery).toBeEmptyDOMElement();
    fetcher.mockResolvedValue({ok:true,json:async()=>({...initial,status})});
    await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});
    expect(recovery).toHaveTextContent('Live updates restored.');
  }
});

it.each([
  ['ready','active',false],['ready','cancelled',false],
  ['submit','completed',false],['submit','cancelled',false],
  ['ready','active',true],['submit','completed',true],
] as const)('retires %s feedback after %s polling, including delayed acknowledgement %s',async(action,status,delayed)=>{
  vi.useFakeTimers();
  const start:ArenaSnapshot=action==='ready' ? initial : {...initial,status:'active',deadline:'2026-11-06T12:05:00Z'};
  let snapshot=start;
  let resolvePost!:(value:unknown)=>void;
  const post=new Promise(resolve=>{resolvePost=resolve;});
  vi.stubGlobal('fetch',vi.fn().mockImplementation((_url,options)=>options?.method==='POST' ? post : Promise.resolve({ok:true,json:async()=>snapshot})));
  render(<Arena initial={start}/>);
  const feedback=document.getElementById('submission-status')!;
  fireEvent.click(screen.getByRole('button',{name:action==='ready' ? 'Ready to duel' : 'Submit solution'}));
  const acknowledge=async()=>{await act(async()=>{resolvePost({ok:true,json:async()=>({status:action==='ready' ? 'pending' : 'queued'})});});};
  if (!delayed) {
    await acknowledge();
    expect(feedback).toHaveTextContent(action==='ready' ? 'Ready. Waiting for both players' : 'Solution queued.');
  }
  snapshot={...start,status,deadline:status==='active' ? '2026-11-06T12:05:00Z' : start.deadline};
  await act(async()=>{await vi.advanceTimersByTimeAsync(0);});
  if (delayed) await acknowledge();
  expect(document.getElementById('submission-status')).toBe(feedback);
  expect(feedback).not.toHaveTextContent(/Waiting for both players|Solution queued|Confirming readiness|Sending your solution/);
  expect(feedback).not.toHaveClass('arena-action-pending');
  expect(feedback).toHaveTextContent(status==='completed' ? 'Results are ready' : status==='cancelled' ? 'No ratings changed' : 'Your best judged solution counts');
});

it.each(['pending','active','settling','completed','cancelled'] as const)('uses lifecycle-aware empty score guidance on reopening %s',phase=>{
  const status=phase==='settling' ? 'active' : phase;
  render(<Arena initial={{...initial,status,deadline:phase==='settling' ? initial.serverTime : '2026-11-06T12:05:00Z'}}/>);
  const expected={pending:'The duel has not started',active:'judged score will appear here',settling:'Submissions are closed. Waiting for the server',completed:'View results for the recorded outcome',cancelled:'This duel was cancelled'}[phase];
  for (const name of ['Your best progress','Opponent progress']) {
    const card=screen.getByRole('region',{name});
    expect(card).toHaveTextContent(expected);
    if (phase!=='active') expect(card).not.toHaveTextContent(/Submit your solution when ready|after they submit|Keep working/);
  }
});
it('updates empty score guidance through activation, expiry and completion polling',async()=>{
  vi.useFakeTimers();
  let snapshot:ArenaSnapshot=initial;
  vi.stubGlobal('fetch',vi.fn().mockImplementation(()=>Promise.resolve({ok:true,json:async()=>snapshot})));
  render(<Arena initial={initial}/>);
  const card=screen.getByRole('region',{name:'Your best progress'});
  snapshot={...initial,status:'active',deadline:'2026-11-06T12:00:01Z'};
  await act(async()=>{await vi.advanceTimersByTimeAsync(0);});
  expect(card).toHaveTextContent('Submit your solution when ready');
  await act(async()=>{await vi.advanceTimersByTimeAsync(1000);});
  expect(card).toHaveTextContent('Submissions are closed. Waiting for the server');
  snapshot={...snapshot,status:'completed'};
  await act(async()=>{await vi.advanceTimersByTimeAsync(1000);});
  expect(card).toHaveTextContent('View results for the recorded outcome');
  expect(card).not.toHaveTextContent('Submit your solution when ready');
});


it('updates latest-attempt correction guidance through clock expiry and terminal polling',async()=>{
  vi.useFakeTimers();
  let snapshot:ArenaSnapshot={...initial,status:'active',deadline:'2026-11-06T12:00:01Z',submission:{status:'judged',passed:0,total:8}};
  vi.stubGlobal('fetch',vi.fn().mockImplementation(()=>Promise.resolve({ok:true,json:async()=>snapshot})));
  render(<Arena initial={snapshot}/>);
  const panel=screen.getByRole('status',{name:'Latest submission'});
  expect(panel).toHaveTextContent('submit a corrected solution');
  await act(async()=>{await vi.advanceTimersByTimeAsync(1000);});
  expect(panel).not.toHaveTextContent('submit a corrected solution');
  expect(panel).toHaveTextContent('Submissions are closed');
  snapshot={...snapshot,status:'completed'};
  await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});
  expect(screen.getByRole('status',{name:'Latest submission'})).toBe(panel);
  expect(panel).toHaveTextContent('View results for the recorded outcome');
  expect(panel).toHaveTextContent('Latest solution: 0 / 8');
});

it.each([false,true])('retries saving the current draft without editing or submitting in plain mode %s',plain=>{
  const confirm=vi.spyOn(window,'confirm').mockReturnValue(false);
  vi.stubGlobal('fetch',vi.fn(()=>new Promise(()=>{})));
  const write=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('quota');});
  render(<Arena initial={initial}/>);
  if(plain) fireEvent.click(screen.getByRole('button',{name:'Use plain text editor'}));
  fireEvent.change(screen.getByLabelText('Python solution'),{target:{value:'current unsaved draft'}});
  const retry=screen.getByRole('button',{name:'Retry saving draft'});
  const guidance=screen.getByText(/Draft recovery unavailable/);
  expect(guidance).toHaveClass('solution-editor-recovery');
  expect(retry).toHaveAccessibleDescription(/Saving a draft does not submit it/);
  retry.focus();
  fireEvent.click(retry);
  expect(retry).toHaveFocus();
  expect(screen.getByLabelText('Python solution')).toHaveValue('current unsaved draft');
  write.mockRestore();
  const recoveredWrite=vi.spyOn(Storage.prototype,'setItem');
  fireEvent.click(retry);
  expect(confirm).not.toHaveBeenCalled();
  expect(recoveredWrite).toHaveBeenCalledExactlyOnceWith('codeduel:draft:Ada:match','current unsaved draft');
  expect(screen.queryByRole('button',{name:'Retry saving draft'})).not.toBeInTheDocument();
  expect(guidance).toHaveTextContent('Draft saved in this tab');
  expect(guidance).not.toHaveClass('solution-editor-recovery');
  expect(guidance).toHaveFocus();
  expect(screen.getByLabelText('Python solution')).toHaveValue('current unsaved draft');
  expect(vi.mocked(fetch).mock.calls.some(call=>call[1]?.method==='POST')).toBe(false);
});
it.each(['completed','cancelled'] as const)('removes draft saving recovery when a match becomes %s',async status=>{
  vi.useFakeTimers();
  const write=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('quota');});
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({...initial,status})}));
  render(<Arena initial={initial}/>);
  fireEvent.change(screen.getByLabelText('Python solution'),{target:{value:'keep this code'}});
  expect(screen.getByRole('button',{name:'Retry saving draft'})).toBeInTheDocument();
  await act(async()=>{await vi.advanceTimersByTimeAsync(0);});
  write.mockClear();
  expect(screen.queryByRole('button',{name:'Retry saving draft'})).not.toBeInTheDocument();
  expect(screen.queryByText(/Draft recovery unavailable/)).not.toBeInTheDocument();
  expect(screen.getByLabelText('Python solution')).toHaveValue('keep this code');
  expect(write).not.toHaveBeenCalled();
});

it.each([false,true])('protects unread stored drafts until explicit replacement in plain mode %s',plain=>{
  vi.spyOn(window,'confirm').mockReturnValue(true);
  vi.stubGlobal('fetch',vi.fn(()=>new Promise(()=>{})));
  const key='codeduel:draft:Ada:match';
  sessionStorage.setItem(key,'valuable earlier draft');
  const originalRead=Storage.prototype.getItem;
  const read=vi.spyOn(Storage.prototype,'getItem').mockImplementation(function(this:Storage,name:string){
    if(this===sessionStorage && name===key) throw new Error('read denied');
    return originalRead.call(this,name);
  });
  const write=vi.spyOn(Storage.prototype,'setItem');
  render(<Arena initial={initial}/>);
  if(plain) fireEvent.click(screen.getByRole('button',{name:'Use plain text editor'}));
  const draftWrites=()=>write.mock.calls.filter(call=>call[0]===key);
  expect(draftWrites()).toHaveLength(0);
  fireEvent.change(screen.getByLabelText('Python solution'),{target:{value:'new intentional draft'}});
  expect(draftWrites()).toHaveLength(0);
  const retry=screen.getByRole('button',{name:'Retry saving draft'});
  expect(retry).toHaveAccessibleDescription(/Automatic saving is paused.*replaces any unread saved draft/);
  read.mockRestore();
  expect(sessionStorage.getItem(key)).toBe('valuable earlier draft');
  const failedWrite=write.mockImplementation(()=>{throw new Error('write denied');});
  retry.focus();
  fireEvent.click(retry);
  expect(retry).toHaveFocus();
  expect(screen.getByLabelText('Python solution')).toHaveValue('new intentional draft');
  expect(sessionStorage.getItem(key)).toBe('valuable earlier draft');
  failedWrite.mockRestore();
  fireEvent.click(retry);
  expect(sessionStorage.getItem(key)).toBe('new intentional draft');
  expect(screen.getByText(/Draft saved in this tab/)).toHaveFocus();
  expect(screen.queryByText(/Automatic saving is paused/)).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Python solution'),{target:{value:'subsequent edit'}});
  expect(sessionStorage.getItem(key)).toBe('subsequent edit');
  expect(vi.mocked(fetch).mock.calls.some(call=>call[1]?.method==='POST')).toBe(false);
});


it.each([false,true])('guards unread recovery before editing and clears after explicit starter save in plain mode %s',plain=>{
  vi.spyOn(window,'confirm').mockReturnValue(true);
  vi.stubGlobal('fetch',vi.fn(()=>new Promise(()=>{})));
  sessionStorage.setItem('codeduel:draft:Ada:match','earlier code');
  const originalRead=Storage.prototype.getItem;
  vi.spyOn(Storage.prototype,'getItem').mockImplementation(function(this:Storage,key:string){
    if(this===sessionStorage) throw new Error('read denied');
    return originalRead.call(this,key);
  });
  const view=render(<Arena initial={initial}/>);
  if(plain) fireEvent.click(screen.getByRole('button',{name:'Use plain text editor'}));
  expect(screen.getByLabelText('Python solution')).toHaveValue('def solve():\n    pass\n');
  expect(leaveIsGuarded()).toBe(true);
  const retry=screen.getByRole('button',{name:'Retry saving draft'});
  expect(retry).toHaveAccessibleDescription(/Your browser may ask for confirmation before leaving or refreshing/);
  const write=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('write denied');});
  retry.focus();
  fireEvent.click(retry);
  expect(retry).toHaveFocus();
  expect(leaveIsGuarded()).toBe(true);
  write.mockRestore();
  fireEvent.click(retry);
  expect(leaveIsGuarded()).toBe(false);
  fireEvent.change(screen.getByLabelText('Python solution'),{target:{value:'edited'}});
  expect(leaveIsGuarded()).toBe(true);
  view.unmount();
  expect(leaveIsGuarded()).toBe(false);
});

it.each(['completed','cancelled'] as const)('clears unread-draft leave protection when the server reports %s',async status=>{
  vi.useFakeTimers();
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({...initial,status})}));
  const originalRead=Storage.prototype.getItem;
  vi.spyOn(Storage.prototype,'getItem').mockImplementation(function(this:Storage,key:string){
    if(this===sessionStorage) throw new Error('read denied');
    return originalRead.call(this,key);
  });
  render(<Arena initial={initial}/>);
  expect(leaveIsGuarded()).toBe(true);
  await act(async()=>{await vi.advanceTimersByTimeAsync(0);});
  expect(leaveIsGuarded()).toBe(false);
  expect(screen.queryByRole('button',{name:'Retry saving draft'})).not.toBeInTheDocument();
});
it.each([false,true])('retries reading earlier drafts safely in plain mode %s',plain=>{
  vi.stubGlobal('fetch',vi.fn(()=>new Promise(()=>{})));
  const key='codeduel:draft:Ada:match';
  sessionStorage.setItem(key,'earlier solution');
  const originalRead=Storage.prototype.getItem;
  let denied=true;
  vi.spyOn(Storage.prototype,'getItem').mockImplementation(function(this:Storage,name:string){
    if(this===sessionStorage && name===key && denied) throw new Error('read denied');
    return originalRead.call(this,name);
  });
  const write=vi.spyOn(Storage.prototype,'setItem');
  render(<Arena initial={initial}/>);
  if(plain) fireEvent.click(screen.getByRole('button',{name:'Use plain text editor'}));
  const retry=screen.getByRole('button',{name:'Retry reading draft'});
  expect(retry).toHaveAccessibleDescription(/recover earlier code without replacing it/);
  retry.focus();
  fireEvent.click(retry);
  expect(retry).toHaveFocus();
  expect(write.mock.calls.filter(call=>call[0]===key)).toHaveLength(0);
  expect(screen.getByLabelText('Python solution')).toHaveValue('def solve():\n    pass\n');
  denied=false;
  fireEvent.click(retry);
  expect(screen.getByLabelText('Python solution')).toHaveValue('earlier solution');
  expect(sessionStorage.getItem(key)).toBe('earlier solution');
  expect(screen.getByText(/Draft saved in this tab/)).toHaveFocus();
  expect(screen.queryByRole('button',{name:'Retry reading draft'})).not.toBeInTheDocument();
  expect(vi.mocked(fetch).mock.calls.some(call=>call[1]?.method==='POST')).toBe(false);
});

it.each([false,true])('pauses draft reading after edits in plain mode %s',plain=>{
  vi.stubGlobal('fetch',vi.fn(()=>new Promise(()=>{})));
  const originalRead=Storage.prototype.getItem;
  vi.spyOn(Storage.prototype,'getItem').mockImplementation(function(this:Storage,key:string){
    if(this===sessionStorage) throw new Error('read denied');
    return originalRead.call(this,key);
  });
  render(<Arena initial={initial}/>);
  if(plain) fireEvent.click(screen.getByRole('button',{name:'Use plain text editor'}));
  expect(screen.getByRole('button',{name:'Retry reading draft'})).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Python solution'),{target:{value:'current edits'}});
  expect(screen.queryByRole('button',{name:'Retry reading draft'})).not.toBeInTheDocument();
  expect(screen.getByLabelText('Python solution')).toHaveValue('current edits');
  expect(screen.getByRole('button',{name:'Retry saving draft'})).toHaveAccessibleDescription(/reading is paused to protect your current code/);
});
it('resumes saving when retry confirms the unread draft slot is empty',()=>{
  vi.stubGlobal('fetch',vi.fn(()=>new Promise(()=>{})));
  const originalRead=Storage.prototype.getItem;
  const read=vi.spyOn(Storage.prototype,'getItem').mockImplementation(function(this:Storage,key:string){
    if(this===sessionStorage) throw new Error('read denied');
    return originalRead.call(this,key);
  });
  render(<Arena initial={initial}/>);
  read.mockRestore();
  fireEvent.click(screen.getByRole('button',{name:'Retry reading draft'}));
  expect(screen.getByText(/Draft saved in this tab/)).toBeInTheDocument();
  expect(sessionStorage.getItem('codeduel:draft:Ada:match')).toBe('def solve():\n    pass\n');
  expect(leaveIsGuarded()).toBe(false);
});

it.each([false,true])('requires fresh consent for unread draft replacement in plain mode %s',plain=>{
  vi.stubGlobal('fetch',vi.fn(()=>new Promise(()=>{})));
  const key='codeduel:draft:Ada:match';
  sessionStorage.setItem(key,'earlier valuable code');
  const originalRead=Storage.prototype.getItem;
  const read=vi.spyOn(Storage.prototype,'getItem').mockImplementation(function(this:Storage,name:string){
    if(this===sessionStorage && name===key) throw new Error('read denied');
    return originalRead.call(this,name);
  });
  const confirm=vi.spyOn(window,'confirm').mockReturnValue(false);
  render(<Arena initial={initial}/>);
  if(plain) fireEvent.click(screen.getByRole('button',{name:'Use plain text editor'}));
  const retry=screen.getByRole('button',{name:'Retry saving draft'});
  retry.focus();
  fireEvent.click(retry);
  expect(confirm).toHaveBeenCalledWith(expect.stringMatching(/Earlier saved code will be lost.*does not submit/));
  expect(retry).toHaveFocus();
  expect(leaveIsGuarded()).toBe(true);
  read.mockRestore();
  expect(sessionStorage.getItem(key)).toBe('earlier valuable code');
  fireEvent.change(screen.getByLabelText('Python solution'),{target:{value:'current code'}});
  fireEvent.click(retry);
  expect(confirm).toHaveBeenCalledTimes(2);
  expect(sessionStorage.getItem(key)).toBe('earlier valuable code');
  confirm.mockReturnValue(true);
  fireEvent.click(retry);
  expect(sessionStorage.getItem(key)).toBe('current code');
  expect(screen.getByText(/Draft saved in this tab/)).toHaveFocus();
  expect(vi.mocked(fetch).mock.calls.some(call=>call[1]?.method==='POST')).toBe(false);
});
