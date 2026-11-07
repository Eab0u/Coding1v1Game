import { readFileSync } from 'node:fs';
import { chromium, type Browser } from '@playwright/test';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';

const username = 'abcdefghijklmnopqrstuvwx';
const state = vi.hoisted(() => ({ signedIn: true, accountUnavailable: false, leaderboardUnavailable: false, profileUnavailable: false, friendsUnavailable: false, homeUnavailable: false }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock('../src/lib/auth-server', () => ({ database: () => ({}), auth: { current: async () => { if (state.accountUnavailable) throw new Error('private'); return state.signedIn ? ({ id: '1', username: 'abcdefghijklmnopqrstuvwx', rating: 800 }) : null; } } }));
vi.mock('../src/lib/home', () => ({ loadHome: async () => { if (state.homeUnavailable) throw new Error('private'); return ({ streak: 0, daily: { title: 'A'.repeat(120), statement: 'B'.repeat(200), function_signature: 'def solve_very_long_function_name(values: list[int]) -> list[int]:', difficulty: 'easy' }, recent: [{ id: '1', title: 'C'.repeat(120), opponent: 'abcdefghijklmnopqrstuvwx', winner_id: '1' }] }); } }));
vi.mock('../src/lib/leaderboard', () => ({ loadLeaderboard: async () => {
  if (state.leaderboardUnavailable) throw new Error('unavailable');
  return [{ username: 'abcdefghijklmnopqrstuvwx', rating: 1234, score: 123, rank: 1 }];
} }));
vi.mock('../src/lib/profile', () => ({ ratingTier: () => 'Bronze', loadProfile: async () => { if (state.profileUnavailable) throw new Error('private'); return ({ username: 'abcdefghijklmnopqrstuvwx', rating: 800, record: { wins: 99999, losses: 99999, draws: 99999 }, ratings: [], history: [{ id: '1', opponent: 'abcdefghijklmnopqrstuvwx', title: 'D'.repeat(120), result: 'WIN', delta: 12, completed_at: new Date('2026-11-01Z') }] }); } }));
import { Arena } from '../src/components/arena';
import { Results } from '../src/components/results';
vi.mock('../src/lib/friends', () => ({ loadFriends: async () => { if (state.friendsUnavailable) throw new Error('private'); return [{ username: 'abcdefghijklmnopqrstuvwx', status: 'pending', incoming: true }, { username: 'another_long_player_name', status: 'accepted', incoming: false }, { username: 'outgoing_long_player_name', status: 'pending', incoming: false }]; } }));
import Friends from '../src/app/friends/page';
import Home from '../src/app/page';
import Profile from '../src/app/profile/[username]/page';
import Leaderboard from '../src/app/leaderboard/page';
import Account from '../src/app/account/page';
import ArenaPage from '../src/app/match/[id]/page';
vi.mock('../src/lib/arena', () => ({ loadArena: async () => { throw new Error('private'); } }));
import ResultsPage from '../src/app/match/[id]/results/page';
vi.mock('../src/lib/results', () => ({ loadResult: async () => { throw new Error('private'); } }));

let browser: Browser;
beforeAll(async () => { browser = await chromium.launch(); });
afterAll(async () => { await browser?.close(); });

it('keeps account recovery visible and keyboard accessible on phones', async () => {
  state.accountUnavailable = true;
  const page = await browser.newPage({ viewport: { width: 320, height: 900 } });
  try {
    await page.setContent(`<style>${readFileSync('src/app/globals.css', 'utf8')}</style>${renderToStaticMarkup(await Account({ searchParams: Promise.resolve({}) }))}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    expect(await page.getByRole('alert').isVisible()).toBe(true);
    expect(await page.locator('form').count()).toBe(0);
    const retry = page.getByRole('link', { name: 'Retry account' });
    expect(await retry.getAttribute('href')).toBe('/account');
    await retry.focus();
    expect(await retry.evaluate(el => el === document.activeElement)).toBe(true);
    expect((await retry.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.keyboard.press('Tab');
    expect(await page.getByRole('link', { name: 'Back to arena' }).evaluate(el => el === document.activeElement)).toBe(true);
  } finally { state.accountUnavailable = false; await page.close(); }
});

it('keeps duel recovery actions visible and keyboard accessible on phones', async () => {
  const page = await browser.newPage({ viewport: { width: 320, height: 900 } });
  try {
    const content = await ArenaPage({ params: Promise.resolve({ id: 'match-id' }) });
    await page.setContent(`<style>${readFileSync('src/app/globals.css', 'utf8')}</style>${renderToStaticMarkup(content)}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    expect(await page.getByRole('alert').isVisible()).toBe(true);
    const retry = page.getByRole('link', { name: 'Retry duel' });
    expect(await retry.getAttribute('href')).toBe('/match/match-id');
    await retry.focus();
    expect(await retry.evaluate(el => el === document.activeElement)).toBe(true);
    expect((await retry.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.keyboard.press('Tab');
    expect(await page.getByRole('link', { name: 'Back to arena' }).evaluate(el => el === document.activeElement)).toBe(true);
  } finally { await page.close(); }
});

it('keeps results recovery actions visible and keyboard accessible on phones', async () => {
  const page = await browser.newPage({ viewport: { width: 320, height: 900 } });
  try {
    const content = await ResultsPage({ params: Promise.resolve({ id: 'match-id' }) });
    await page.setContent(`<style>${readFileSync('src/app/globals.css', 'utf8')}</style>${renderToStaticMarkup(content)}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    expect(await page.getByRole('alert').isVisible()).toBe(true);
    const retry = page.getByRole('link', { name: 'Retry results' });
    expect(await retry.getAttribute('href')).toBe('/match/match-id/results');
    await retry.focus();
    expect(await retry.evaluate(el => el === document.activeElement)).toBe(true);
    expect((await retry.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.keyboard.press('Tab');
    expect(await page.getByRole('link', { name: 'Back to arena' }).evaluate(el => el === document.activeElement)).toBe(true);
  } finally { await page.close(); }
});

it('keeps dashboard recovery visible and keyboard accessible on phones', async () => {
  state.homeUnavailable = true;
  const page = await browser.newPage({ viewport: { width: 320, height: 900 } });
  try {
    await page.setContent(`<style>${readFileSync('src/app/globals.css', 'utf8')}</style>${renderToStaticMarkup(await Home())}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    expect(await page.getByRole('alert').isVisible()).toBe(true);
    const retry = page.getByRole('link', { name: 'Retry dashboard' });
    await retry.focus();
    expect(await retry.evaluate(el => el === document.activeElement)).toBe(true);
    expect((await retry.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.keyboard.press('Tab');
    expect(await page.getByRole('link', { name: 'View leaderboard' }).evaluate(el => el === document.activeElement)).toBe(true);
  } finally { state.homeUnavailable = false; await page.close(); }
});

it('keeps leaderboard recovery actions visible and keyboard accessible on phones', async () => {
  state.leaderboardUnavailable = true;
  const page = await browser.newPage({ viewport: { width: 320, height: 900 } });
  try {
    const content = await Leaderboard({ searchParams: Promise.resolve({ period: 'weekly' }) });
    await page.setContent(`<style>${readFileSync('src/app/globals.css', 'utf8')}</style>${renderToStaticMarkup(content)}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    expect(await page.getByRole('alert').isVisible()).toBe(true);
    const retry = page.getByRole('link', { name: 'Retry standings' });
    await retry.focus();
    expect(await retry.evaluate(el => el === document.activeElement)).toBe(true);
    expect((await retry.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.keyboard.press('Tab');
    expect(await page.getByRole('link', { name: 'Back to arena' }).evaluate(el => el === document.activeElement)).toBe(true);
  } finally { state.leaderboardUnavailable = false; await page.close(); }
});

it('keeps profile recovery actions visible and keyboard accessible on phones', async () => {
  state.profileUnavailable = true;
  const page = await browser.newPage({ viewport: { width: 320, height: 900 } });
  try {
    const content = await Profile({ params: Promise.resolve({ username }) });
    await page.setContent(`<style>${readFileSync('src/app/globals.css', 'utf8')}</style>${renderToStaticMarkup(content)}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    expect(await page.getByRole('alert').isVisible()).toBe(true);
    const retry = page.getByRole('link', { name: 'Retry profile' });
    await retry.focus();
    expect(await retry.evaluate(el => el === document.activeElement)).toBe(true);
    expect((await retry.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.keyboard.press('Tab');
    expect(await page.getByRole('link', { name: 'Back to arena' }).evaluate(el => el === document.activeElement)).toBe(true);
  } finally { state.profileUnavailable = false; await page.close(); }
});

it('keeps friends recovery actions visible and keyboard accessible on phones', async () => {
  state.friendsUnavailable = true;
  const page = await browser.newPage({ viewport: { width: 320, height: 900 } });
  try {
    const content = await Friends({ searchParams: Promise.resolve({}) });
    await page.setContent(`<style>${readFileSync('src/app/globals.css', 'utf8')}</style>${renderToStaticMarkup(content)}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    expect(await page.getByRole('alert').isVisible()).toBe(true);
    const retry = page.getByRole('link', { name: 'Retry friends' });
    await retry.focus();
    expect(await retry.evaluate(el => el === document.activeElement)).toBe(true);
    expect((await retry.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.keyboard.press('Tab');
    expect(await page.getByRole('link', { name: 'Back to arena' }).evaluate(el => el === document.activeElement)).toBe(true);
  } finally { state.friendsUnavailable = false; await page.close(); }
});

it('keeps populated pages within phone, tablet and desktop viewports with usable scroll regions', async () => {
  const pages = [<Results key="results" result={{title:'X'.repeat(150),outcome:'WIN',players:[{username,before:800,after:808,passed:8,total:8,cpu:1,submitted:1000},{username:'another_long_player_name',before:800,after:792,passed:0,total:8,cpu:1000,submitted:null}]}}/>, await Friends({ searchParams: Promise.resolve({}) }), await Home(), await Profile({ params: Promise.resolve({ username }) }), await Leaderboard({ searchParams: Promise.resolve({ period: 'weekly' }) }), await Account({ searchParams: Promise.resolve({}) })];
  state.signedIn = false;
  pages.push(await Account({ searchParams: Promise.resolve({}) }), await Home());
  const css = readFileSync('src/app/globals.css', 'utf8');
  const page = await browser.newPage();
  try {
    for (const width of [320, 375, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      for (const content of pages) {
        await page.setContent(`<style>${css}</style>${renderToStaticMarkup(content)}`);
        expect(await page.evaluate(() => document.documentElement.scrollWidth), `page overflow at ${width}px`).toBeLessThanOrEqual(width);
        for (const region of await page.locator('.ladder-scroll').all()) {
          expect(await region.getAttribute('role')).toBe('region');
          expect(await region.getAttribute('aria-label')).toBeTruthy();
          await region.focus();
          expect(await region.evaluate(el => el === document.activeElement)).toBe(true);
          if (await region.evaluate(el => el.scrollWidth > el.clientWidth)) {
            await page.keyboard.press('ArrowRight');
            await expect.poll(() => region.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
          }
        }
        for (const button of await page.locator('.button, .site-header a').all()) {
          expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        }
      }
    }
  } finally { await page.close(); }
}, 30000);

it('keeps feedback readable on phones and disables cue motion when requested', async () => {
  const page = await browser.newPage({ viewport: { width: 320, height: 600 } });
  try {
    const css = readFileSync('src/app/globals.css', 'utf8');
    await page.setContent(`<style>${css}</style><div class="duel-feedback"><button class="button">Sound off</button><span class="duel-feedback-status"><span class="duel-cue duel-cue--win">Victory</span></span></div>`);
    expect(await page.locator('.duel-cue').evaluate(el => getComputedStyle(el).animationName)).toBe('cue-arrival');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await page.locator('.duel-cue').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
    expect(await page.locator('.duel-cue').isVisible()).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  } finally { await page.close(); }
});

it('animates rating changes and respects reduced motion', async()=>{
 const page=await browser.newPage();
 try {
  await page.setContent(`<style>${readFileSync('src/app/globals.css','utf8')}</style><span class="rating-change">+8</span>`);
  expect(await page.locator('.rating-change').evaluate(el=>getComputedStyle(el).animationName)).toBe('rating-arrive');
  await page.emulateMedia({reducedMotion:'reduce'});
  expect(await page.locator('.rating-change').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
 } finally {await page.close();}
});


it('keeps the arena readable with keyboard-scrollable code on narrow screens', async () => {
  const page = await browser.newPage();
  const css = readFileSync('src/app/globals.css', 'utf8');
  try {
    for (const status of ['pending', 'active', 'completed', 'cancelled']) {
      const content = renderToStaticMarkup(<Arena initial={{
        id: 'arena', status, deadline: '2026-11-06T12:05:00Z', serverTime: '2026-11-06T12:00:00Z',
        player: { username, rating: 800 }, opponent: { username: 'another_long_player_name', rating: 1200 },
        problem: { title: 'X'.repeat(150), statement: 'Y'.repeat(200), signature: `def solve_${'z'.repeat(200)}():`, difficulty: 'medium', constraints: 'N'.repeat(200), examples: [{ args: ['a'.repeat(200)], expected: 'b'.repeat(200), explanation: 'E'.repeat(200) }] },
        progress: { passed: 123, total: 456 },
      }}/>);
      for (const width of [320, 375, 768, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        await page.setContent(`<style>${css}</style>${content}`);
        expect(await page.evaluate(() => document.documentElement.scrollWidth), `${status} overflow at ${width}px`).toBeLessThanOrEqual(width);
        for (const label of ['Function signature', 'Example 1 input', 'Example 1 expected output']) {
          const region = page.getByRole('region', { name: label, exact: true });
          await region.focus();
          expect(await region.evaluate(el => el === document.activeElement)).toBe(true);
          await page.keyboard.press('ArrowRight');
          await expect.poll(() => region.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
        }
        if (width <= 375) {
          const clock = (await page.locator('.arena-clock').boundingBox())!;
          const player = (await page.locator('.arena-scoreboard > div').first().boundingBox())!;
          expect(clock.y + clock.height).toBeLessThanOrEqual(player.y);
          for (const button of await page.locator('.arena-editor > button').all()) {
            expect((await button.boundingBox())!.width).toBeGreaterThan(200);
          }
        }
      }
    }
  } finally { await page.close(); }
}, 30000);

