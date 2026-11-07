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
