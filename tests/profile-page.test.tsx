import { render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('../src/lib/auth-server', () => ({ database: () => ({}) }));
vi.mock('../src/lib/profile', async importOriginal => ({ ...await importOriginal<typeof import('../src/lib/profile')>(), loadProfile: mocks.load }));
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND'); } }));
import Profile from '../src/app/profile/[username]/page';
const params = Promise.resolve({username:'Ada'});
beforeEach(() => { mocks.load.mockResolvedValue({username:'Ada',rating:800,record:{wins:0,losses:0,draws:0},history:[],ratings:[]}); });
it('shows a new player record and honest graph and history empty states', async () => {
  render(await Profile({params}));
  expect(screen.getByRole('heading',{name:'Ada'})).toBeVisible();
  expect(screen.getByText('Bronze')).toBeVisible();
  expect(screen.getByText(/Your rating journey starts/)).toBeVisible();
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  expect(screen.getByRole('link',{name:'Find a duel'})).toHaveAttribute('href','/');
  expect(screen.queryByText(/Scroll the table sideways/)).not.toBeInTheDocument();
});
it('renders a constant rating graph, accessible data, opponent links and unrated matches', async () => {
  mocks.load.mockResolvedValue({username:'Ada',rating:1200,record:{wins:1,losses:0,draws:1},ratings:[{rating_before:1200,rating_after:1200,completed_at:new Date('2026-01-01Z')}],history:[{id:'1',title:'Test',opponent:'Bob',result:'DRAW',delta:null,completed_at:new Date('2026-01-01Z')}]});
  render(await Profile({params}));
  expect(screen.getByRole('img')).toHaveAccessibleName(/from 1200 to 1200/);
  expect(screen.getByRole('img').innerHTML).not.toMatch(/NaN|Infinity/);
  expect(screen.getByText('Rating history data')).toBeVisible();
  expect(screen.getByRole('link',{name:'Bob'})).toHaveAttribute('href','/profile/Bob');
  expect(screen.getByText('Unrated')).toBeVisible();
});
it('contains infrastructure errors without showing false empty records', async () => {
  mocks.load.mockRejectedValue(new Error('SECRET'));
  render(await Profile({params}));
  expect(screen.getByRole('alert')).toHaveTextContent('Profile unavailable');
  expect(screen.queryByText(/SECRET|No completed duels|Your rating journey/)).not.toBeInTheDocument();
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  expect(screen.getByRole('link', {name:'Retry profile'})).toHaveAttribute('href','/profile/Ada');
  expect(screen.getByRole('link', {name:'Back to arena'})).toHaveAttribute('href','/');
});
it('returns not found for unknown or invalid players', async () => {
  mocks.load.mockResolvedValue(null);
  await expect(Profile({params})).rejects.toThrow('NOT_FOUND');
  mocks.load.mockClear();
  await expect(Profile({params:Promise.resolve({username:'bad!'})})).rejects.toThrow('NOT_FOUND');
  expect(mocks.load).not.toHaveBeenCalled();
});

it('preserves the requested player on retry and recovers with fresh profile data', async () => {
  const requested = Promise.resolve({username:'Another_Player'});
  mocks.load.mockRejectedValueOnce(new Error('private database detail'));
  const view = render(await Profile({params:requested}));
  expect(screen.getByRole('link',{name:'Retry profile'})).toHaveAttribute('href','/profile/Another_Player');
  view.unmount();
  render(await Profile({params:requested}));
  expect(mocks.load).toHaveBeenLastCalledWith({}, 'Another_Player');
  expect(screen.getByRole('heading',{name:'Ada'})).toBeVisible();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.queryByRole('link',{name:'Retry profile'})).not.toBeInTheDocument();
});


it.each([
  { before: 800, after: 840, change: '+40 MMR', low: 780, high: 860 },
  { before: 840, after: 800, change: '-40 MMR', low: 780, high: 860 },
  { before: 0, after: 0, change: '0 MMR', low: 0, high: 20 },
  { before: 800.4, after: 800.6, change: '+1 MMR', low: 780, high: 840 },
])('labels rating history honestly for $before to $after MMR', async ({before, after, change, low, high}) => {
  mocks.load.mockResolvedValue({username:'Ada',rating:after,record:{wins:0,losses:0,draws:0},history:[],ratings:[{rating_before:before,rating_after:after,completed_at:new Date('2026-01-02T01:00:00Z')}]});
  const {container} = render(await Profile({params}));
  expect(container.querySelector('.rating-change strong')).toHaveTextContent(change);
  expect(container.querySelector('.rating-axis')).toHaveTextContent(`${high} MMR${low} MMR`);
  expect(screen.getByRole('img')).toHaveAccessibleName(new RegExp(`vertical scale ${low} to ${high} MMR`));
  expect(screen.getByRole('img').innerHTML).not.toMatch(/NaN|Infinity/);
  expect(screen.getByText('Before first duel')).toBeVisible();
  expect(container.querySelector('.rating-timeline time')).toHaveAttribute('datetime', '2026-01-02T01:00:00.000Z');
  expect(container.querySelector('.profile-climb')).toHaveTextContent('Last 1 rated duel');
  expect(container.querySelector('.profile-climb')).not.toHaveTextContent('Last 1 rated duels');
  expect(container.querySelector('.profile-climb')).not.toHaveTextContent(/\?|\u00c2|\u00e2/);
});

it('scales the chart to intermediate peaks and shows the whole window change', async () => {
  mocks.load.mockResolvedValue({username:'Ada',rating:810,record:{wins:1,losses:1,draws:0},history:[],ratings:[
    {rating_before:800,rating_after:1000,completed_at:new Date('2026-01-01Z')},
    {rating_before:1000,rating_after:810,completed_at:new Date('2026-01-02Z')},
  ]});
  const {container} = render(await Profile({params}));
  expect(screen.getByRole('img')).toHaveAccessibleName(/from 800 to 810 MMR; vertical scale 780 to 1020 MMR/);
  expect(container.querySelector('.rating-change strong')).toHaveTextContent('+10 MMR');
  expect(container.querySelector('.profile-climb')).toHaveTextContent('Last 2 rated duels');
});


it('distinguishes history outcomes and formats rounded MMR changes without signed zero', async () => {
  mocks.load.mockResolvedValue({username:'Ada',rating:800,record:{wins:1,losses:1,draws:1},ratings:[],history:[
    {id:'1',title:'First',opponent:'Bob',result:'WIN',delta:12.2,completed_at:new Date('2026-01-01Z')},
    {id:'2',title:'Second',opponent:'Cat',result:'LOSS',delta:-8.8,completed_at:new Date('2026-01-02Z')},
    {id:'3',title:'Third',opponent:'Dog',result:'DRAW',delta:-0.2,completed_at:new Date('2026-01-03Z')},
    {id:'4',title:'Fourth',opponent:'Fox',result:'DRAW',delta:0.2,completed_at:new Date('2026-01-04Z')},
  ]});
  render(await Profile({params}));
  for (const result of ['WIN','LOSS','DRAW']) {
    for (const badge of screen.getAllByText(result, {exact:true})) expect(badge).toHaveClass(`history-result--${result.toLowerCase()}`);
  }
  expect(screen.getByText('+12 MMR')).toBeVisible();
  expect(screen.getByText('-9 MMR')).toBeVisible();
  expect(screen.getAllByText('0 MMR')).toHaveLength(2);
  expect(screen.queryByText(/^[+-]0 MMR$/)).not.toBeInTheDocument();
  expect(screen.getByRole('region',{name:'Recent duel history'})).toHaveAccessibleDescription(/Scroll the table sideways.*arrow keys/);
});


it('shows chronological rating changes with machine-readable dates and consistent rounded deltas', async () => {
  mocks.load.mockResolvedValue({username:'Ada',rating:810,record:{wins:1,losses:1,draws:1},history:[],ratings:[
    {rating_before:800.4,rating_after:810.6,completed_at:new Date('2026-01-01Z')},
    {rating_before:810.6,rating_after:809.8,completed_at:new Date('2026-01-02Z')},
    {rating_before:809.8,rating_after:810.2,completed_at:new Date('2026-01-03Z')},
  ]});
  const {container} = render(await Profile({params}));
  const list = screen.getByRole('list',{name:'Rated duel changes',hidden:true});
  expect(list.querySelectorAll('li')).toHaveLength(3);
  expect(Array.from(list.querySelectorAll('strong')).map(el => el.textContent)).toEqual(['+11 MMR change','-1 MMR change','0 MMR change']);
  expect(Array.from(list.querySelectorAll('time')).map(el => el.dateTime)).toEqual(['2026-01-01T00:00:00.000Z','2026-01-02T00:00:00.000Z','2026-01-03T00:00:00.000Z']);
  expect(container.querySelector('.rating-history')).not.toHaveAttribute('open');
  expect(screen.getByText(/Oldest to newest/)).toHaveTextContent('Dates are UTC');
});
