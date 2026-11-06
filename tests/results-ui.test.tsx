import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DuelSound } from '../src/lib/duel-sound';
import { Results } from '../src/components/results';
import type { DuelResult } from '../src/lib/results';
const players=[{username:'Ada',before:800,after:808,passed:8,total:8,cpu:12.345,submitted:1250},{username:'Bob',before:800,after:792,passed:5,total:8,cpu:42,submitted:null}];
beforeEach(()=>localStorage.clear());
afterEach(()=>vi.restoreAllMocks());
it.each([
 ['WIN','win','Victory'],['LOSS','loss','Defeat'],['DRAW','draw','Honors shared'],
] as const)('offers muted visual feedback and opt-in replay for %s',(outcome,cue,label)=>{
 const play=vi.spyOn(DuelSound.prototype,'play').mockImplementation(()=>{});
 const unlock=vi.spyOn(DuelSound.prototype,'unlock').mockImplementation(()=>{});
 localStorage.setItem('codeduel-sound','on');
 const result={title:'Sample',outcome,players};
 const view=render(<Results result={result}/>);
 expect(screen.getByText(label)).toHaveClass(`duel-cue--${cue}`);
 expect(play).not.toHaveBeenCalled();
 expect(unlock).not.toHaveBeenCalled();
 const first=screen.getByText(label);
 view.rerender(<Results result={{...result}}/>);
 expect(screen.getByText(label)).toBe(first);
 fireEvent.click(screen.getByRole('button',{name:'Replay result'}));
 expect(unlock).toHaveBeenCalledOnce();
 expect(play).toHaveBeenLastCalledWith(cue);
 expect(screen.getByText(label)).not.toBe(first);
 fireEvent.click(screen.getByRole('button',{name:'Sound on'}));
 play.mockClear();
 fireEvent.click(screen.getByRole('button',{name:'Replay result'}));
 expect(play).not.toHaveBeenCalled();
 expect(screen.getByText(label)).toBeVisible();
});
it.each(['WIN','LOSS','DRAW'] as const)('shows authoritative %s and side by side final metrics',outcome=>{
 render(<Results result={{title:'Sample',outcome,players}}/>);
 expect(screen.getByRole('heading',{name:outcome})).toBeVisible();
 expect(screen.getByLabelText('Rating change +8')).toBeVisible();
 expect(screen.getByLabelText('Rating change -8')).toBeVisible();
 expect(screen.getByText('12.35 ms')).toBeVisible();
 expect(screen.getByText('1.25 s')).toBeVisible();
 expect(screen.getByText('No submission')).toBeVisible();
 expect(screen.getByRole('link',{name:'New match'})).toHaveAttribute('href','/');
 expect(screen.queryByText('Rematch invitations are not available yet.')).not.toBeInTheDocument();
});
it('does not invent missing historical metrics or rating changes',()=>{
 const p={username:'Ada',before:null,after:null,passed:null,total:null,cpu:null,submitted:null};
 render(<Results result={{title:'Legacy',outcome:'DRAW',players:[p,{...p,username:'Bob'}]} as DuelResult}/>);
 expect(screen.getAllByText('Rating not recorded')).toHaveLength(2);
 expect(screen.getAllByText('Not recorded')).toHaveLength(6);
});
