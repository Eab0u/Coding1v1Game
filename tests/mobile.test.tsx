import { readFileSync } from 'node:fs';
import { chromium, type Browser } from '@playwright/test';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';

const username = 'abcdefghijklmnopqrstuvwx';
const state = vi.hoisted(() => ({ signedIn: true, accountUnavailable: false, leaderboardUnavailable: false, leaderboardEmpty: false, profileUnavailable: false, friendsUnavailable: false, homeUnavailable: false }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock('../src/lib/auth-server', () => ({ database: () => ({}), auth: { current: async () => { if (state.accountUnavailable) throw new Error('private'); return state.signedIn ? ({ id: '1', username: 'abcdefghijklmnopqrstuvwx', rating: 800 }) : null; } } }));
vi.mock('../src/lib/home', () => ({ loadHome: async () => { if (state.homeUnavailable) throw new Error('private'); return ({ streak: 0, daily: { title: 'A'.repeat(120), statement: 'B'.repeat(200), function_signature: 'def solve_very_long_function_name(values: list[int]) -> list[int]:', difficulty: 'easy' }, recent: [{ id: '1', title: 'C'.repeat(120), opponent: 'abcdefghijklmnopqrstuvwx', winner_id: '1' }] }); } }));
vi.mock('../src/lib/leaderboard', () => ({ loadLeaderboard: async () => {
  if (state.leaderboardUnavailable) throw new Error('unavailable');
  if (state.leaderboardEmpty) return [];
  return [{ username: 'abcdefghijklmnopqrstuvwx', rating: 1234, score: 123, rank: 1 }];
} }));
vi.mock('../src/lib/profile', () => ({ ratingTier: () => 'Bronze', loadProfile: async () => { if (state.profileUnavailable) throw new Error('private'); return ({ username: 'abcdefghijklmnopqrstuvwx', rating: 800, record: { wins: 99999, losses: 99999, draws: 99999 }, ratings: [{ rating_before: 800, rating_after: 1234, completed_at: new Date('2026-11-01Z') }], history: [{ id: '1', opponent: 'abcdefghijklmnopqrstuvwx', title: 'D'.repeat(120), result: 'WIN', delta: 12, completed_at: new Date('2026-11-01Z') }] }); } }));
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

it.each([320, 375, 1280])('makes weekly standings guidance and player links usable at %spx', async width => {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  try {
    await page.setContent(`<style>${readFileSync('src/app/globals.css', 'utf8')}</style>${renderToStaticMarkup(await Leaderboard({ searchParams: Promise.resolve({ period: 'weekly' }) }))}`);
    const region = page.getByRole('region', { name: 'Leaderboard standings' });
    expect(await region.getAttribute('aria-describedby')).toBe('standings-scroll-hint');
    expect(await page.locator('#standings-scroll-hint').isVisible()).toBe(true);
    expect(await page.getByRole('cell', { name: '+123 MMR', exact: true }).isVisible()).toBe(true);
    await region.focus();
    if (await region.evaluate(el => el.scrollWidth > el.clientWidth)) {
      await page.keyboard.press('ArrowRight');
      await expect.poll(() => region.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
    }
    await page.keyboard.press('Tab');
    const player = page.locator('.standings-player');
    expect(await player.evaluate(el => el === document.activeElement)).toBe(true);
    expect((await player.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await player.evaluate(el => getComputedStyle(el).textDecorationLine)).toContain('underline');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  } finally { await page.close(); }
});

it.each([320, 375, 1280])('supports results skip navigation and player touch targets at %spx', async width => {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  try {
    const player = { username, before: 800, after: 808, passed: 8, total: 8, cpu: 1, submitted: 1000 };
    await page.setContent(`<style>${readFileSync('src/app/globals.css', 'utf8')}</style>${renderToStaticMarkup(<Results result={{ title: 'Sample', outcome: 'WIN', players: [player, { ...player, username: 'another_long_player_name' }] }}/>)}`);
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to results' });
    expect(await skip.evaluate(el => el === document.activeElement)).toBe(true);
    expect((await skip.boundingBox())!.y).toBeGreaterThanOrEqual(0);
    await page.keyboard.press('Enter');
    expect(await page.getByRole('main').evaluate(el => el === document.activeElement)).toBe(true);
    await page.keyboard.press('Tab');
    const links = page.locator('.result-player h2 a');
    expect(await links.first().evaluate(el => el === document.activeElement)).toBe(true);
    await page.keyboard.press('Tab');
    expect(await links.last().evaluate(el => el === document.activeElement)).toBe(true);
    for (const link of await links.all()) {
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      expect(await link.evaluate(el => getComputedStyle(el).textDecorationLine)).toContain('underline');
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  } finally { await page.close(); }
});

it.each([true, false])('keeps empty friends standings actions usable on phones (signed in: %s)', async signedIn => {
  state.signedIn = signedIn;
  state.leaderboardEmpty = true;
  const page = await browser.newPage({ viewport: { width: 320, height: 900 } });
  try {
    await page.setContent(`<style>${readFileSync('src/app/globals.css', 'utf8')}</style>${renderToStaticMarkup(await Leaderboard({ searchParams: Promise.resolve({ period: 'weekly', scope: 'friends' }) }))}`);
    const actions = page.locator('.ladder-empty-actions a');
    expect(await actions.count()).toBe(2);
    for (const action of await actions.all()) {
      const bounds = (await action.boundingBox())!;
      expect(bounds.height).toBeGreaterThanOrEqual(44);
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
    }
    await actions.first().focus();
    expect(await actions.first().evaluate(el => el === document.activeElement)).toBe(true);
    await page.keyboard.press('Tab');
    expect(await actions.last().evaluate(el => el === document.activeElement)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  } finally { state.signedIn = true; state.leaderboardEmpty = false; await page.close(); }
});

it.each([320, 375, 1280])('opens daily challenge statements with the keyboard at %spx', async width => {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  try {
    await page.setContent(`<style>${readFileSync('src/app/globals.css', 'utf8')}</style>${renderToStaticMarkup(await Home())}`);
    const summary = page.locator('.daily-statement summary');
    const statement = page.locator('.daily-statement > div');
    expect(await statement.isVisible()).toBe(false);
    expect((await summary.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await summary.focus();
    await page.keyboard.press('Enter');
    expect(await statement.isVisible()).toBe(true);
    expect(await page.locator('.daily-statement').getAttribute('open')).not.toBeNull();
    expect(await statement.evaluate(el => getComputedStyle(el).whiteSpace)).toBe('pre-wrap');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.keyboard.press('Space');
    expect(await statement.isVisible()).toBe(false);
  } finally { await page.close(); }
});

it('makes recent duel results and opponents keyboard accessible on narrow phones', async () => {
  const page = await browser.newPage({ viewport: { width: 320, height: 900 } });
  try {
    await page.setContent(`<style>${readFileSync('src/app/globals.css', 'utf8')}</style>${renderToStaticMarkup(await Home())}`);
    const results = page.locator('.recent-duel-result');
    const opponent = page.locator('.recent-duel-opponent');
    expect(await results.getAttribute('href')).toBe('/match/1/results');
    expect(await opponent.getAttribute('href')).toBe(`/profile/${username}`);
    for (const link of [results, opponent]) {
      const bounds = (await link.boundingBox())!;
      expect(bounds.height).toBeGreaterThanOrEqual(44);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
    }
    await results.focus();
    expect(await results.evaluate(el => el === document.activeElement)).toBe(true);
    await page.keyboard.press('Tab');
    expect(await opponent.evaluate(el => el === document.activeElement)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  } finally { await page.close(); }
});

it('keeps populated password guidance within the phone account layout', async () => {
  state.signedIn = false;
  const page = await browser.newPage({ viewport: { width: 320, height: 900 } });
  try {
    await page.setContent(`<style>${readFileSync('src/app/globals.css', 'utf8')}</style>${renderToStaticMarkup(await Account({ searchParams: Promise.resolve({}) }))}`);
    // Static markup has no React handlers; populate the status regions for layout coverage.
    await page.locator('.password-caps-lock').evaluateAll(elements => elements.forEach(element => {
      element.textContent = 'Caps Lock is on. Passwords are case-sensitive.';
    }));
    await page.locator('.password-validation').evaluateAll(elements => elements.forEach(element => {
      element.textContent = 'Use at least 12 characters.';
    }));
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    for (const warning of await page.locator('.password-caps-lock').all()) {
      expect(await warning.isVisible()).toBe(true);
      const bounds = (await warning.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
    }
    const password = page.getByLabel('Password', { exact: true }).first();
    await password.focus();
    await page.keyboard.press('Tab');
    expect(await page.getByRole('button', { name: 'Show sign-in password' }).evaluate(el => el === document.activeElement)).toBe(true);
  } finally { state.signedIn = true; await page.close(); }
});

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


it('keeps friend invitation feedback and keyboard submission usable at 320px', async () => {
  const wasSignedIn = state.signedIn;
  state.signedIn = true;
  const page = await browser.newPage({ viewport: { width: 320, height: 900 } });
  try {
    await page.setContent(`<style>${readFileSync('src/app/globals.css', 'utf8')}</style>${renderToStaticMarkup(await Friends({ searchParams: Promise.resolve({}) }))}`);
    // Component tests cover events; populate the static fixture to check error layout.
    const feedback = page.locator('#friend-username-error');
    await feedback.evaluate(element => { element.textContent = 'Use 3?24 letters, numbers or underscores for a player username.'; });
    expect(await feedback.isVisible()).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    const bounds = (await feedback.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
    await page.getByLabel('Player username').focus();
    await page.keyboard.press('Tab');
    const submit = page.getByRole('button', { name: 'Send friend request' });
    expect(await submit.evaluate(element => element === document.activeElement)).toBe(true);
    expect((await submit.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  } finally { state.signedIn = wasSignedIn; await page.close(); }
});


it('keeps rating scales, timeline and history data usable at phone and desktop widths', async () => {
  const page = await browser.newPage();
  try {
    await page.setContent(`<style>${readFileSync('src/app/globals.css', 'utf8')}</style>${renderToStaticMarkup(await Profile({params:Promise.resolve({username})}))}`);
    for (const width of [320, 375, 1280]) {
      await page.setViewportSize({width, height:900});
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      for (const selector of ['.rating-axis', '.rating-chart', '.rating-timeline', '.rating-change']) {
        const element = page.locator(selector);
        expect(await element.isVisible()).toBe(true);
        const bounds = (await element.boundingBox())!;
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      }
      const summary = page.getByText('Rating history data', {exact:true});
      expect((await summary.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await summary.focus();
      await page.keyboard.press('Enter');
      expect(await page.locator('.profile-climb details').getAttribute('open')).not.toBeNull();
      expect(await page.locator('.profile-climb details ol').isVisible()).toBe(true);
      await page.keyboard.press('Enter');
    }
  } finally { await page.close(); }
});


it.each([320, 375, 1280])('keeps profile duel outcomes and scroll guidance accessible at %spx', async width => {
  const page = await browser.newPage({viewport:{width,height:900}});
  try {
    await page.setContent(`<style>${readFileSync('src/app/globals.css','utf8')}</style>${renderToStaticMarkup(await Profile({params:Promise.resolve({username})}))}`);
    const region = page.getByRole('region',{name:'Recent duel history'});
    expect(await region.getAttribute('aria-describedby')).toBe('history-scroll-hint');
    expect(await page.locator('#history-scroll-hint').isVisible()).toBe(true);
    const badge = region.locator('.history-result--win');
    expect(await badge.textContent()).toBe('WIN');
    expect(await badge.evaluate(el => getComputedStyle(el).borderTopStyle)).toBe('solid');
    await region.focus();
    expect(await region.evaluate(el => el === document.activeElement)).toBe(true);
    if (width < 640) {
      await page.keyboard.press('ArrowRight');
      await page.waitForFunction(() => document.querySelector('.profile-history .ladder-scroll')!.scrollLeft > 0);
    }
    await page.keyboard.press('Tab');
    const opponent = region.getByRole('link',{name:username});
    expect(await opponent.evaluate(el => el === document.activeElement)).toBe(true);
    expect((await opponent.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  } finally { await page.close(); }
});
