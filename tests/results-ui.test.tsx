import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { RATING_TIERS } from '../src/lib/profile';
import { DuelSound } from '../src/lib/duel-sound';
import { Results } from '../src/components/results';
import type { DuelResult } from '../src/lib/results';
const players=[{username:'Ada',before:800,after:808,passed:8,total:8,cpu:12.345,submitted:1250},{username:'Bob',before:800,after:792,passed:5,total:8,cpu:42,submitted:2000}];
beforeEach(()=>localStorage.clear());
it('keeps the explanation consistent with unsafe score cards and recovers corrected history',()=>{
 const result:DuelResult={title:'Saved duel',outcome:'WIN',players:players.map(p=>({...p,total:Number.MAX_SAFE_INTEGER+1,submitted:1000}))};
 const view=render(<Results result={result}/>);
 const explanation=within(screen.getByRole('region',{name:'How this duel was decided'}));
 expect(explanation.getByText(/detailed scoring explanation is unavailable/)).toBeVisible();
 expect(screen.getAllByText('Test score unavailable')).toHaveLength(2);
 expect(screen.queryByRole('progressbar')).toBeNull();
 expect(screen.getByRole('heading',{name:'WIN'})).toBeVisible();
 view.rerender(<Results result={{...result,players:players.map(p=>({...p,submitted:1000}))}}/>);
 expect(explanation.getByText(/^You passed more hidden tests/)).toBeVisible();
 expect(screen.queryByText('Test score unavailable')).toBeNull();
 expect(screen.getAllByRole('progressbar')).toHaveLength(2);
});
it.each(['before','after'] as const)('withholds invalid saved %s ratings and recovers valid history',field=>{
 const result={title:'Sample',outcome:'WIN' as const,players};
 const view=render(<Results result={result}/>);
 for (const value of [-1,NaN,Infinity,-Infinity,undefined]) {
  view.rerender(<Results result={{...result,players:[{...players[0],[field]:value},players[1]]} as DuelResult}/>);
  const yours=within(screen.getByRole('region',{name:'Your result'}));
  expect(yours.getByText('Rating unavailable')).toBeVisible();
  expect(yours.getByText(/saved rating change could not be verified/)).toHaveTextContent('recorded match outcome still applies');
  expect(yours.queryByLabelText(/Rating change/)).not.toBeInTheDocument();
  expect(yours.queryByText(/Tier unchanged|Tier changed from|Previously|MMR/)).not.toBeInTheDocument();
  expect(screen.getByLabelText('Rating change -8')).toBeVisible();
  expect(screen.getByRole('heading',{name:'WIN'})).toBeVisible();
 }
 view.rerender(<Results result={{...result,players:[{...players[0],before:0,after:1000.1},players[1]]}}/>);
 const yours=within(screen.getByRole('region',{name:'Your result'}));
 expect(yours.queryByText('Rating unavailable')).not.toBeInTheDocument();
 expect(yours.getByLabelText('Rating change +1000')).toBeVisible();
 expect(yours.getByText('Tier changed from Bronze to Silver')).toBeVisible();
 view.rerender(<Results result={{...result,players:[{...players[0],before:null,after:null},players[1]]}}/>);
 expect(yours.getByText('Rating not recorded')).toBeVisible();
 expect(yours.queryByLabelText(/Rating change/)).not.toBeInTheDocument();
});
it.each([[0,'No hidden tests passed'],[5,'Some hidden tests passed'],[8,'All hidden tests passed']] as const)('shows saved correctness accessibly for %s passes',(passed,label)=>{
 render(<Results result={{title:'Sample',outcome:'DRAW',players:[{...players[0],passed}]}}/>);
 const meter=screen.getByRole('progressbar',{name:`Hidden-test progress ${passed} / 8 passed`});
 expect(meter).toHaveAttribute('value',String(passed));
 expect(meter).toHaveAttribute('max','8');
 expect(meter).toHaveAttribute('aria-valuetext',`${passed} of 8 hidden tests passed`);
 expect(screen.getByText(label)).toBeVisible();
 expect(screen.getByText(label)).toHaveClass('badge','result-correctness-badge');
 expect(meter.parentElement).toHaveClass(`result-correctness--${passed===8?'full':'partial'}`);
});
it('removes verdict styling for invalid or absent scores and recovers corrected scores',()=>{
 const result={title:'Sample',outcome:'WIN' as const,players:[players[0]]};
 const view=render(<Results result={result}/>);
 for(const score of [{passed:-1,total:8},{passed:9,total:8},{passed:NaN,total:8},{passed:0,total:0},{passed:null,total:null}]) {
  view.rerender(<Results result={{...result,players:[{...players[0],...score}]}}/>);
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  expect(view.container.querySelector('.result-correctness-badge')).toBeNull();
  expect(view.container.querySelector('.result-correctness--full, .result-correctness--partial')).toBeNull();
 }
 view.rerender(<Results result={{...result,players:[{...players[0],passed:0}]}}/>);
 expect(screen.getByText('No hidden tests passed')).toHaveClass('result-correctness-badge');
 expect(screen.getByRole('progressbar').parentElement).toHaveClass('result-correctness--partial');
 view.rerender(<Results result={result}/>);
 expect(screen.getByRole('progressbar').parentElement).toHaveClass('result-correctness--full');
 view.rerender(<Results result={{...result,players:[{...players[0],passed:0,submitted:null}]}}/>);
 expect(screen.getByText('No judged submission')).toBeVisible();
 expect(view.container.querySelector('.result-correctness-badge')).toBeNull();
});
it.each([null,0])('does not invent a correctness meter for unavailable totals %s',total=>{
 render(<Results result={{title:'Legacy',outcome:'DRAW',players:[{...players[0],passed:null,total}]}}/>);
 expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
 expect(screen.getAllByText('Not recorded')).toHaveLength(2);
});
it('gives both player meters distinct label associations',()=>{
 render(<Results result={{title:'Sample',outcome:'WIN',players:[players[0],{...players[1],submitted:2000}]}}/>);
 const meters=screen.getAllByRole('progressbar');
 expect(meters).toHaveLength(2);
 expect(meters[0].id).not.toBe(meters[1].id);
 expect(meters[1]).toHaveAccessibleName('Hidden-test progress 5 / 8 passed');
});
it('explains best-attempt metrics, units, tie order and display precision',()=>{
 render(<Results result={{title:'Sample',outcome:'WIN',players}}/>);
 const guide=screen.getByRole('region',{name:'Reading the comparison'});
 const disclosure=guide.querySelector('details')!;
 expect(disclosure).not.toHaveAttribute('open');
 expect(guide.querySelector('summary')).toHaveTextContent('Reading the comparison');
 expect(guide.querySelector('summary')).toHaveAttribute('id','metrics-guide-title');
 expect(guide).toHaveAttribute('aria-labelledby','metrics-guide-title');
 expect(guide).toHaveTextContent('best judged submission counts, even if a later attempt was weaker');
 expect(guide).toHaveTextContent('Milliseconds of CPU time on the largest tests, using the median of three runs');
 expect(guide).toHaveTextContent('Lower is better when hidden test counts tie');
 expect(guide).toHaveTextContent('Seconds from the start of the duel to that best submission');
 expect(guide).toHaveTextContent('Earlier wins only when correctness and CPU time tie');
 expect(guide).toHaveTextContent('Displayed times are rounded; scoring uses saved precision');
 expect(guide.querySelectorAll('dt')).toHaveLength(2);
});
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
 expect(screen.getByText('2.00 s')).toBeVisible();
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

it('links to the completed problem with honest code and submission guidance',()=>{
 render(<Results matchId="duel/#" result={{title:'Sample',outcome:'WIN',players}}/>);
 const review=screen.getByRole('region',{name:'Learn from this duel'});
 expect(review).toHaveTextContent('problem statement and examples');
 expect(review).toHaveTextContent('Submissions are closed');
 expect(review).toHaveTextContent('reopening does not restore your submitted code');
 expect(screen.getByRole('link',{name:'Review problem'})).toHaveAttribute('href','/match/duel%2F%23');
});
it('omits problem review when no match identifier is available',()=>{
 render(<Results result={{title:'Legacy',outcome:'DRAW',players}}/>);
 expect(screen.queryByRole('region',{name:'Learn from this duel'})).not.toBeInTheDocument();
 expect(screen.queryByRole('link',{name:'Review problem'})).not.toBeInTheDocument();
});

it('distinguishes fallback scores from measured zero-pass attempts and missing history',()=>{
 const view=render(<Results result={{title:'Sample',outcome:'DRAW',players:[{...players[0],passed:0,submitted:null,cpu:1000}]}}/>);
 expect(screen.getByText('No judged submission')).toBeVisible();
 expect(screen.getByText('Fallback benchmark CPU')).toBeVisible();
 expect(screen.getByText(/rather than measured execution time/)).toBeVisible();
 expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
 expect(screen.getByText('1000.00 ms')).toBeVisible();
 view.rerender(<Results result={{title:'Sample',outcome:'DRAW',players:[{...players[0],passed:0,submitted:0}]}}/>);
 expect(screen.queryByText('No judged submission')).not.toBeInTheDocument();
 expect(screen.getByRole('progressbar')).toHaveAttribute('value','0');
 expect(screen.getByText('Median benchmark CPU')).toBeVisible();
 view.rerender(<Results result={{title:'Legacy',outcome:'DRAW',players:[{...players[0],passed:null,submitted:null,cpu:null}]}}/>);
 expect(screen.queryByText('No judged submission')).not.toBeInTheDocument();
 expect(screen.queryByText('Fallback benchmark CPU')).not.toBeInTheDocument();
});

it.each([
 {passed:-1,total:8}, {passed:9,total:8}, {passed:1.5,total:8},
 {passed:0,total:0}, {passed:1,total:null}, {passed:1,total:8.5},
 {passed:NaN,total:8}, {passed:1,total:Infinity},
 {passed:Number.MAX_SAFE_INTEGER+1,total:Number.MAX_SAFE_INTEGER+1},
])('withholds invalid saved correctness and recovers valid results %j',score=>{
 const result: DuelResult={title:'Saved duel',outcome:'WIN',players:[{...players[0],...score}]};
 const {rerender}=render(<Results result={result}/>);
 expect(screen.queryByRole('progressbar')).toBeNull();
 expect(screen.getByText('Test score unavailable')).toBeVisible();
 expect(screen.getByText('Unavailable',{exact:true})).toBeVisible();
 expect(screen.getByRole('heading',{name:'WIN'})).toBeVisible();
 expect(screen.getByText(/recorded match outcome above still applies/)).toBeVisible();
 rerender(<Results result={{...result,players:[{...result.players[0],submitted:null}]}}/>);
 expect(screen.queryByText('No judged submission')).toBeNull();
 expect(screen.queryByText('Fallback benchmark CPU')).toBeNull();
 for (const passed of [0,3,8]) {
  rerender(<Results result={{...result,players:[{...players[0],passed}]}}/>);
  expect(screen.getByRole('progressbar')).toHaveAttribute('value',String(passed));
  expect(screen.queryByText('Test score unavailable')).toBeNull();
  expect(screen.queryByText('Unavailable',{exact:true})).toBeNull();
 }
 rerender(<Results result={{...result,players:[{...players[0],passed:null,total:null}]}}/>);
 expect(screen.queryByRole('progressbar')).toBeNull();
 expect(screen.queryByText('Test score unavailable')).toBeNull();
 expect(screen.getAllByText('Not recorded').length).toBeGreaterThan(0);
});

it.each([-1, NaN, Infinity, -Infinity, undefined])('withholds invalid saved timing values %s and recovers valid times', value=>{
 const result:DuelResult={title:'Sample',outcome:'WIN',players:[{...players[0],cpu:value as number,submitted:value as number}]};
 const view=render(<Results result={result}/>);
 const panel=within(screen.getByRole('region',{name:'Your result'}));
 expect(panel.getAllByText('Unavailable')).toHaveLength(2);
 expect(panel.queryByRole('progressbar')).toBeNull();
 expect(panel.getByText('Submission history unavailable')).toBeVisible();
 expect(screen.getByRole('heading',{name:'WIN'})).toBeVisible();
 expect(screen.getByRole('region',{name:'Reading the comparison'})).toHaveTextContent('Invalid saved times are shown as unavailable; the recorded match outcome still applies.');
 view.rerender(<Results result={{...result,players:[{...players[0],cpu:0,submitted:0}]}}/>);
 expect(panel.queryByText('Unavailable')).not.toBeInTheDocument();
 expect(panel.getByText('0.00 ms')).toBeVisible();
 expect(panel.getByText('0.00 s')).toBeVisible();
 view.rerender(<Results result={{...result,players:[players[0]]}}/>);
 expect(panel.getByText('12.35 ms')).toBeVisible();
 expect(panel.getByText('1.25 s')).toBeVisible();
 view.rerender(<Results result={{...result,players:[{...players[0],passed:0,cpu:null,submitted:null}]}}/>);
 expect(panel.getByText('Not recorded')).toBeVisible();
 expect(panel.getByText('No submission')).toBeVisible();
});

it.each(['before','after'] as const)('reports corrupt %s ratings even when the other rating is missing',field=>{
 const other=field==='before'?'after':'before';
 const result={title:'Legacy',outcome:'DRAW' as const,players:[players[0]]};
 const view=render(<Results result={result}/>);
 for(const value of [-1,NaN,Infinity,-Infinity,undefined]) {
  view.rerender(<Results result={{...result,players:[{...players[0],[field]:value,[other]:null}]} as DuelResult}/>);
  expect(screen.getByText('Rating unavailable')).toBeVisible();
  expect(screen.queryByText('Rating not recorded')).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/Rating change/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Tier unchanged|Tier changed from/)).not.toBeInTheDocument();
  expect(screen.getByRole('heading',{name:'DRAW'})).toBeVisible();
 }
 view.rerender(<Results result={{...result,players:[{...players[0],[field]:0,[other]:null}]}}/>);
 expect(screen.getByText('Rating not recorded')).toBeVisible();
 expect(screen.queryByText('Rating unavailable')).not.toBeInTheDocument();
 view.rerender(<Results result={result}/>);
 expect(screen.getByLabelText('Rating change +8')).toBeVisible();
 expect(screen.queryByText('Rating not recorded')).not.toBeInTheDocument();
});

it.each([0,1])('withholds false no-submission guidance for player %s and recovers',index=>{
 const result:DuelResult={title:'Saved duel',outcome:'DRAW',players:players.map(p=>({...p,passed:8,cpu:10,submitted:1000}))};
 result.players[index].submitted=null;
 const view=render(<Results result={result}/>);
 const panel=within(screen.getByRole('region',{name:index===0?'Your result':'Opponent result'}));
 expect(panel.getByText('Submission history unavailable')).toBeVisible();
 expect(panel.queryByText('No judged submission')).toBeNull();
 expect(panel.queryByText('No submission')).toBeNull();
 expect(panel.queryByText('Fallback benchmark CPU')).toBeNull();
 expect(panel.getByText('Unavailable')).toBeVisible();
 expect(screen.getByRole('region',{name:'How this duel was decided'})).toHaveTextContent('explanation is unavailable');
 expect(screen.getByRole('heading',{name:'DRAW'})).toBeVisible();
 result.players[index].submitted=1000;
 view.rerender(<Results result={{...result}}/>);
 expect(panel.queryByText('Submission history unavailable')).toBeNull();
 expect(panel.getByText('All hidden tests passed')).toBeVisible();
 expect(screen.getByRole('region',{name:'How this duel was decided'})).toHaveTextContent('were all tied');
 result.players[index].submitted=null;
 result.players[index].passed=0;
 view.rerender(<Results result={{...result}}/>);
 expect(panel.getByText('No judged submission')).toBeVisible();
 expect(panel.getByText('Fallback benchmark CPU')).toBeVisible();
});

it.each([0,1])('withholds verdict cues for invalid submission history for player %s and recovers', index=>{
 const result:DuelResult={title:'Saved duel',outcome:'WIN',players:players.map(p=>({...p}))};
 const view=render(<Results result={result}/>);
 for (const submitted of [-1,NaN,Infinity,-Infinity,undefined,'1000']) {
  const corrupted={...result,players:result.players.map((p,i)=>i===index?{...p,submitted}:p)} as DuelResult;
  view.rerender(<Results result={corrupted}/>);
  const card=within(screen.getByRole('region',{name:index===0?'Your result':'Opponent result'}));
  expect(card.getByText('Submission history unavailable')).toBeVisible();
  expect(card.getByText(/saved submission time could not be verified/)).toBeVisible();
  expect(card.queryByRole('progressbar')).toBeNull();
  expect(card.queryByText(/^(All|Some|No) hidden tests passed$/)).toBeNull();
  expect(card.getByText(`${players[index].passed} / 8`)).toBeVisible();
  expect(screen.getByText(/detailed scoring explanation is unavailable/)).toBeVisible();
  expect(screen.getByRole('heading',{name:'WIN'})).toBeVisible();
 }
 view.rerender(<Results result={result}/>);
 expect(screen.queryByText('Submission history unavailable')).toBeNull();
 expect(screen.getAllByRole('progressbar')).toHaveLength(2);
 expect(screen.getByText(/^You passed more hidden tests/)).toBeVisible();
});

it('links directly to a focusable comparison and hides the shortcut without players',()=>{
 const result:DuelResult={title:'Saved duel',outcome:'WIN',players};
 const view=render(<Results result={result}/>);
 expect(screen.getByRole('link',{name:'Compare players'})).toHaveAttribute('href','#player-comparison');
 expect(screen.getByRole('heading',{name:'Player comparison'})).toHaveAttribute('tabindex','-1');
 expect(screen.getByRole('heading',{name:'Player comparison'})).toHaveAttribute('id','player-comparison');
 view.rerender(<Results result={{...result,players:[]}}/>);
 expect(screen.queryByRole('link',{name:'Compare players'})).toBeNull();
 expect(screen.queryByRole('heading',{name:'Player comparison'})).toBeNull();
});
