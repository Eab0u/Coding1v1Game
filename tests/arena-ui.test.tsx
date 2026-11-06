import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { ArenaSnapshot } from "../src/lib/arena";
vi.mock('next/dynamic',()=>({default:()=>function Editor({value,onChange,readOnly}:{value:string;onChange:(v:string)=>void;readOnly:boolean}) {return <textarea aria-label="Python solution" value={value} onChange={e=>onChange(e.target.value)} readOnly={readOnly}/>;}}));
import { Arena,remainingSeconds } from "../src/components/arena";
const initial:ArenaSnapshot={id:'match',status:'pending',deadline:null,serverTime:'2026-11-06T12:00:00Z',player:{username:'Ada',rating:800},opponent:{username:'Bob',rating:900},problem:{title:'Sample',statement:'Find an answer',signature:'def solve():',difficulty:'easy',constraints:'n <= 100',examples:[{input:[1],output:1}]},progress:null};
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
it('uses server time and clamps expired deadlines',()=>{
  expect(remainingSeconds(null,initial.serverTime,0)).toBeNull();
  expect(remainingSeconds('2026-11-06T12:05:00Z',initial.serverTime,1000)).toBe(299);
  expect(remainingSeconds('2026-11-06T12:05:00Z',initial.serverTime,400000)).toBe(0);
});
it('shows pending state and editable drafts without implying submission works',()=>{
  vi.stubGlobal('fetch',vi.fn());
  render(<Arena initial={initial}/>);
  expect(screen.getByRole('timer')).toHaveTextContent('Waiting to start');
  expect(screen.getByRole('button',{name:'Submit solution'})).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Python solution'),{target:{value:'my draft'}});
  expect(screen.getByLabelText('Python solution')).toHaveValue('my draft');
  expect(screen.getByText(/No judged submission/)).toBeInTheDocument();
});
it('refreshes authoritative progress without overwriting code and reports stale updates',async()=>{
  vi.useFakeTimers();
  const fetcher=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({...initial,status:'active',deadline:'2026-11-06T12:05:00Z',progress:{passed:3,total:8}})}).mockRejectedValue(new Error());
  vi.stubGlobal('fetch',fetcher);
  const view=render(<Arena initial={initial}/>);
  fireEvent.change(screen.getByLabelText('Python solution'),{target:{value:'draft'}});
  await act(async()=>{await vi.advanceTimersByTimeAsync(0);});
  expect(screen.getByRole('timer')).toHaveTextContent('5:00');
  expect(screen.getByRole('progressbar')).toHaveAttribute('value','3');
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
