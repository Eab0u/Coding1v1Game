import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { RATING_TIERS } from '../src/lib/profile';
import { DuelSound } from '../src/lib/duel-sound';
import { Results } from '../src/components/results';
import type { DuelResult } from '../src/lib/results';
const players=[{username:'Ada',before:800,after:808,passed:8,total:8,cpu:12.345,submitted:1250},{username:'Bob',before:800,after:792,passed:5,total:8,cpu:42,submitted:null}];
beforeEach(()=>localStorage.clear());
it.each([
 [800,808,'+8','gain','MMR gained'],
 [800,792,'-8','loss','MMR lost'],
 [800,800,'+0','unchanged','MMR unchanged'],
 [800.1,800.4,'+0','unchanged','MMR unchanged'],
 [800.4,800.1,'+0','unchanged','MMR unchanged'],
 [800.49,800.51,'+1','gain','MMR gained'],
 [800.51,800.49,'-1','loss','MMR lost'],
] as const)('styles and labels displayed rating changes %s to %s',(before,after,change,direction,label)=>{
 render(<Results result={{title:'Sample',outcome:'DRAW',players:[{...players[0],before,after}]}}/>);
 const badge=screen.getByLabelText(`Rating change ${change}`);
 expect(badge).toHaveClass(`rating-change--${direction}`);
 expect(badge).toHaveTextContent(label);
 expect(screen.getByText('Change compares rounded MMR totals.')).toBeVisible();
});
it('provides a focusable results destination and encoded player profile links',()=>{
 render(<Results result={{title:'Sample',outcome:'WIN',players:[players[0],{...players[1],username:'Rival name/#'}]}}/>);
 expect(screen.getByRole('link',{name:'Skip to results'})).toHaveAttribute('href','#main-content');
 expect(screen.getByRole('main')).toHaveAttribute('id','main-content');
 expect(screen.getByRole('main')).toHaveAttribute('tabindex','-1');
 expect(screen.getByRole('link',{name:'Ada'})).toHaveAttribute('href','/profile/Ada');
 expect(screen.getByRole('link',{name:'Rival name/#'})).toHaveAttribute('href','/profile/Rival%20name%2F%23');
});
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
 expect(screen.getByRole('region',{name:'How this duel was decided'})).toHaveTextContent(outcome==='WIN'?'You passed more hidden tests':'A detailed scoring explanation is unavailable');
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
 expect(screen.queryByText(/Tier unchanged|Tier changed from/)).not.toBeInTheDocument();
});
it.each(RATING_TIERS.slice(1))('shows both directions at the $name threshold without rounding into a tier',({name,minimum})=>{
 const previous=RATING_TIERS[RATING_TIERS.findIndex(t=>t.name===name)-1].name;
 render(<Results result={{title:'Boundary',outcome:'DRAW',players:[
  {...players[0],before:minimum-.1,after:minimum},
  {...players[1],before:minimum,after:minimum-.1},
 ]}}/>);
 expect(screen.getByText(`Tier changed from ${previous} to ${name}`)).toBeVisible();
 expect(screen.getByText(`Tier changed from ${name} to ${previous}`)).toBeVisible();
 expect(screen.getByText(name,{selector:'.badge'})).toBeVisible();
 expect(screen.getByText(previous,{selector:'.badge'})).toBeVisible();
});
it('labels unchanged tiers and explains saved duel precision',()=>{
 render(<Results result={{title:'Sample',outcome:'WIN',players}}/>);
 expect(screen.getAllByText('Tier unchanged')).toHaveLength(2);
 expect(screen.getAllByText('Bronze',{selector:'.badge'})).toHaveLength(2);
 expect(screen.getAllByText('Tier after this duel, based on full-precision MMR before display rounding.')).toHaveLength(2);
});

it('shows the saved completion instant in UTC across a date boundary',()=>{
 render(<Results result={{title:'Sample',outcome:'WIN',players,completedAt:'2026-11-07T01:15:00+03:00'}}/>);
 const date=screen.getByText('Nov 6, 2026, 22:15 UTC');
 expect(date).toHaveAttribute('datetime','2026-11-06T22:15:00.000Z');
 expect(screen.getByRole('region',{name:'Match outcome'})).toContainElement(date);
});
it.each([undefined,null,'invalid'])('handles historical completion dates safely (%s)',completedAt=>{
 const {container}=render(<Results result={{title:'Legacy',outcome:'DRAW',players,completedAt}}/>);
 expect(screen.getByText('Completion date unavailable')).toBeVisible();
 expect(container.querySelector('time')).toBeNull();
});
