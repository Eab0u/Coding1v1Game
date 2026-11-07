import { readFileSync } from 'node:fs';
import { chromium, type Browser } from '@playwright/test';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';

const username = 'abcdefghijklmnopqrstuvwx';
const state = vi.hoisted(() => ({ signedIn: true, accountUnavailable: false, leaderboardUnavailable: false, leaderboardEmpty: false, profileUnavailable: false, profileEmpty: false, friendsUnavailable: false, friendsEmpty: false, homeUnavailable: false, homeOutcomes: false }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock('../src/lib/auth-server', () => ({ database: () => ({}), auth: { current: async () => { if (state.accountUnavailable) throw new Error('private'); return state.signedIn ? ({ id: '1', username: 'abcdefghijklmnopqrstuvwx', rating: 800 }) : null; } } }));
vi.mock('../src/lib/home', () => ({ loadHome: async () => { if (state.homeUnavailable) throw new Error('private'); return ({ streak: 0, daily: { title: 'A'.repeat(120), topics: ['arrays', 'dynamic programming', 'T'.repeat(200)], examples: [{ args: ['X'.repeat(300)], expected: 1, explanation: 'Read the signal.' }], statement: 'B'.repeat(200), constraints: '1 <= n <= 100000\n' + 'C'.repeat(200), function_signature: `def solve_${'long_name_'.repeat(20)}(values: list[int]) -> list[int]:`, difficulty: 'easy' }, recent: [...(state.homeOutcomes ? [{ id: 'loss', title: 'Lost duel', opponent: 'another_long_player_name', winner_id: '2' }, { id: 'draw', title: 'Drawn duel', opponent: 'another_long_player_name', winner_id: null }] : []), { id: '1', delta: 12.6, completed_at: new Date('2026-11-06T23:05:00Z'), title: 'C'.repeat(120), opponent: 'abcdefghijklmnopqrstuvwx', winner_id: '1' }] }); } }));
vi.mock('../src/lib/leaderboard', () => ({ loadLeaderboard: async () => {
  if (state.leaderboardUnavailable) throw new Error('unavailable');
  if (state.leaderboardEmpty) return [];
  return [{ username: 'abcdefghijklmnopqrstuvwx', rating: 1234, score: 123, rank: 1 }];
} }));
vi.mock('../src/lib/profile', async importOriginal => ({ ...await importOriginal<typeof import('../src/lib/profile')>(), loadProfile: async () => { if (state.profileUnavailable) throw new Error('private'); if (state.profileEmpty) return {username, rating:800, record:{wins:0,losses:0,draws:0},ratings:[],history:[]}; return ({ username: 'abcdefghijklmnopqrstuvwx', rating: 800, record: { wins: 99999, losses: 99999, draws: 99999 }, ratings: [{ rating_before: 800, rating_after: 1234, completed_at: new Date('2026-11-01Z') }], history: [{ id: '1', opponent: 'abcdefghijklmnopqrstuvwx', title: 'D'.repeat(120), result: 'WIN', delta: 12, completed_at: new Date('2026-11-01Z') }] }); } }));
import { Arena } from '../src/components/arena';
import { Results } from '../src/components/results';
vi.mock('../src/lib/friends', () => ({ loadFriends: async () => { if (state.friendsUnavailable) throw new Error('private'); if (state.friendsEmpty) return []; return [{ username: 'abcdefghijklmnopqrstuvwx', rating: 999.75, status: 'pending', incoming: true }, { username: 'another_long_player_name', rating: 999.75, status: 'accepted', incoming: false }, { username: 'outgoing_long_player_name', rating: 999.75, status: 'pending', incoming: false }]; } }));
import Friends from '../src/app/friends/page';
import NotFound from '../src/app/not-found';
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

it.each([320, 375, 1280])('keeps unavailable-page recovery usable at %spx', async width => {
  const page = await browser.newPage({ viewport: { width, height: 600 } });
  try {
    await page.setContent(`<style>${readFileSync('src/app/globals.css', 'utf8')}</style>${renderToStaticMarkup(<NotFound />)}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.keyboard.press('Tab');
    expect(await page.getByRole('link', {name:'Skip to page recovery'}).evaluate(el => document.activeElement === el)).toBe(true);
    await page.keyboard.press('Enter');
    expect(await page.getByRole('main').evaluate(el => document.activeElement === el)).toBe(true);
    for (const name of ['Back to arena', 'Explore standings']) {
      await page.keyboard.press('Tab');
      const link = page.getByRole('link', {name});
      expect(await link.evaluate(el => document.activeElement === el)).toBe(true);
      const bounds = (await link.boundingBox())!;
      expect(bounds.height).toBeGreaterThanOrEqual(44);
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    }
  } finally { await page.close(); }
});

it.each([320, 375, 1280])('jumps to friend sections with native keyboard focus at %spx', async width => {
  const page = await browser.newPage({ viewport: { width, height: 600 } });
  try {
    await page.setContent(`<style>${readFileSync('src/app/globals.css', 'utf8')}</style>${renderToStaticMarkup(await Friends({searchParams:Promise.resolve({})}))}`);
    const ratings = page.locator('.friend-rating');
    expect(await ratings.count()).toBe(3);
    for (const rating of await ratings.all()) {
      expect(await rating.textContent()).toBe('1000 MMRBronze');
      expect(await rating.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      expect(await rating.evaluate(el => getComputedStyle(el).display)).toBe('flex');
    }
    const navigation = page.getByRole('navigation', {name:'Friend sections'});
    const invite = navigation.getByRole('link', {name:'Invite a player'});
    const inviteBounds = (await invite.boundingBox())!;
    expect(inviteBounds.height).toBeGreaterThanOrEqual(44);
    expect(inviteBounds.x + inviteBounds.width).toBeLessThanOrEqual(width);
    await invite.focus();
    await page.keyboard.press('Enter');
    expect(await page.getByRole('heading', {name:'Invite a player'}).evaluate(el => document.activeElement === el)).toBe(true);
    await page.keyboard.press('Tab');
    expect(await page.getByRole('textbox', {name:'Player username'}).evaluate(el => document.activeElement === el)).toBe(true);
    const comparisons = page.locator('.friend-standings');
    expect(await comparisons.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    for (const link of await comparisons.getByRole('link').all()) {
      const bounds = (await link.boundingBox())!;
      expect(bounds.height).toBeGreaterThanOrEqual(44);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    }
    const guide = page.locator('.friend-guide');
    expect(await guide.getByRole('heading', {name:'How your circle works'}).isVisible()).toBe(true);
    expect(await guide.locator('dt').count()).toBe(3);
    expect(await guide.evaluate(el => getComputedStyle(el).borderLeftWidth)).toBe('4px');
    expect(await guide.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    const columns = await guide.locator('dl').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').filter(track => parseFloat(track) > 0).length);
    expect(columns).toBe(width < 400 ? 1 : 3);
    for (const title of ['Incoming requests', 'Your friends', 'Sent requests']) {
      const link = navigation.getByRole('link', {name:`${title} 1`});
      const bounds = (await link.boundingBox())!;
      expect(bounds.height).toBeGreaterThanOrEqual(44);
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      await link.focus();
      expect(await link.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
      await page.keyboard.press('Enter');
      const section = page.getByRole('region', {name:`${title} 1`});
      expect(await section.evaluate(el => document.activeElement === el)).toBe(true);
      expect(await section.evaluate(el => el.matches(':target'))).toBe(true);
      expect(await section.evaluate(el => el.getBoundingClientRect().top)).toBeGreaterThanOrEqual(0);
      await page.keyboard.press('Tab');
      expect(await section.getByRole('link').first().evaluate(el => document.activeElement === el)).toBe(true);
      if (title === 'Your friends') {
        expect(await section.getByRole('link', {name:'Compare friends ratings'}).evaluate(el => document.activeElement === el)).toBe(true);
        await page.keyboard.press('Tab');
        expect(await section.getByRole('link', {name:'Compare friends this week'}).evaluate(el => document.activeElement === el)).toBe(true);
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  } finally { await page.close(); }
});

it.each([320, 375, 1280])('exposes home friends navigation to keyboards and touch at %spx', async width => {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  try {
    await page.setContent(`<style>${readFileSync('src/app/globals.css', 'utf8')}</style>${renderToStaticMarkup(await Home())}`);
    const friends = page.getByRole('link', { name: 'Friends', exact: true });
    expect(await friends.getAttribute('href')).toBe('/friends');
    const bounds = (await friends.boundingBox())!;
    expect(bounds.height).toBeGreaterThanOrEqual(44);
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    await page.getByRole('link', { name: 'Your profile', exact: true }).focus();
    await page.keyboard.press('Tab');
    expect(await friends.evaluate(el => el === document.activeElement)).toBe(true);
    expect(await friends.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
    await page.keyboard.press('Tab');
    expect(await page.getByRole('link', { name: `Account: ${username}` }).evaluate(el => el === document.activeElement)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  } finally { await page.close(); }
});

it.each([320, 375, 1280])('opens the rating tier guide with the keyboard at %spx', async width => {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  try {
    await page.setContent(`<style>${readFileSync('src/app/globals.css', 'utf8')}</style>${renderToStaticMarkup(await Profile({params:Promise.resolve({username})}))}`);
    const summary = page.locator('.tier-guide summary');
    const list = page.getByRole('list', {name:'Rating tier thresholds'});
    expect(await list.isVisible()).toBe(false);
    expect((await summary.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await summary.focus();
    await page.keyboard.press('Enter');
    expect(await list.isVisible()).toBe(true);
    expect(await list.locator('li').count()).toBe(6);
    expect(await list.locator('.tier-guide-current').textContent()).toBe('Bronze0+ MMRCurrent tier');
    for (const row of await list.locator('li').all()) {
      const bounds = (await row.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.keyboard.press('Space');
    expect(await list.isVisible()).toBe(false);
    await page.keyboard.press('Tab');
    expect(await page.locator('.rating-history summary').evaluate(el => el === document.activeElement)).toBe(true);
  } finally { await page.close(); }
});

it.each([320, 375, 1280])('makes friend profile links visible and keyboard accessible at %spx', async width => {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  try {
    await page.setContent(`<style>${readFileSync('src/app/globals.css', 'utf8')}</style>${renderToStaticMarkup(await Friends({ searchParams: Promise.resolve({}) }))}`);
    const links = page.locator('.friend-list h3 a');
    expect(await links.count()).toBe(3);
    for (const link of await links.all()) {
      expect(await link.getAttribute('aria-label')).toBe(`View ${await link.textContent()}'s profile`);
      expect(await link.getAttribute('href')).toBe(`/profile/${await link.textContent()}`);
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      expect(await link.evaluate(el => getComputedStyle(el).textDecorationLine)).toContain('underline');
      await link.focus();
      expect(await link.evaluate(el => el === document.activeElement)).toBe(true);
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('BUTTON');
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  } finally { await page.close(); }
});

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

it.each([320, 375, 1280])('distinguishes result rating directions with contained labels at %spx', async width => {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  try {
    const player = { username, before: 800, after: 808, passed: 8, total: 8, cpu: 1, submitted: 1000 };
    await page.setContent(`<style>${readFileSync('src/app/globals.css', 'utf8')}</style>${renderToStaticMarkup(<Results result={{ title: 'Sample', outcome: 'DRAW', players: [player, {...player, username:'Rival', after:792}, {...player, username:'Third', after:800}] }}/>)}`);
    const colors = [];
    for (const direction of ['gain', 'loss', 'unchanged']) {
      const badge = page.locator(`.rating-change--${direction}`);
      colors.push(await badge.evaluate(el => getComputedStyle(el).color));
      const box = (await badge.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(await badge.locator('small').isVisible()).toBe(true);
    }
    expect(new Set(colors).size).toBe(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  } finally { await page.close(); }
});

it.each([320, 375, 1280])('supports results skip navigation and player touch targets at %spx', async width => {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  try {
    const player = { username, before: 999.9, after: 1000, passed: 8, total: 8, cpu: 1, submitted: 1000 };
    await page.setContent(`<style>${readFileSync('src/app/globals.css', 'utf8')}</style>${renderToStaticMarkup(<Results result={{ title: 'Sample', completedAt: '2026-11-06T23:45:00Z', outcome: 'WIN', players: [player, { ...player, username: 'another_long_player_name' }] }}/>)}`);
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to results' });
    expect(await skip.evaluate(el => el === document.activeElement)).toBe(true);
    expect((await skip.boundingBox())!.y).toBeGreaterThanOrEqual(0);
    await page.keyboard.press('Enter');
    expect(await page.getByRole('main').evaluate(el => el === document.activeElement)).toBe(true);
    await page.keyboard.press('Tab');
    const timestamp = page.locator('.result-banner time');
    expect(await timestamp.getAttribute('datetime')).toBe('2026-11-06T23:45:00.000Z');
    const dateBox = (await timestamp.boundingBox())!;
    expect(dateBox.x).toBeGreaterThanOrEqual(0);
    expect(dateBox.x + dateBox.width).toBeLessThanOrEqual(width);
    const links = page.locator('.result-player h2 a');
    expect(await page.getByRole('progressbar').count()).toBe(2);
    for (const meter of await page.getByRole('progressbar').all()) {
      expect(await meter.getAttribute('aria-valuetext')).toBe('8 of 8 hidden tests passed');
      const box = (await meter.boundingBox())!;
      expect(box.width).toBeGreaterThan(100);
      expect(box.height).toBeGreaterThanOrEqual(14);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
    const guide = page.getByRole('region', { name: 'Reading the comparison' });
    expect(await guide.isVisible()).toBe(true);
    for (const metric of await guide.locator('dl > div').all()) {
      const box = (await metric.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(await metric.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
    }
    expect(await page.locator('.result-tier .badge').allTextContents()).toEqual(['Silver', 'Silver']);
    expect(await page.getByText('Tier changed from Bronze to Silver').count()).toBe(2);
    for (const panel of await page.locator('.result-tier').all()) {
      expect(await panel.evaluate(el => getComputedStyle(el).borderTopStyle)).toBe('solid');
      const box = (await panel.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
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
    const topics = page.getByRole('list', { name: 'Daily challenge topics' });
    expect(await topics.isVisible()).toBe(true);
    expect(await topics.locator('li').count()).toBe(3);
    expect(await topics.evaluate(el => getComputedStyle(el).flexWrap)).toBe('wrap');
    const summary = page.locator('.daily-statement summary');
    const statement = page.locator('.daily-statement > div');
    expect(await statement.isVisible()).toBe(false);
    expect((await summary.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await summary.focus();
    await page.keyboard.press('Enter');
    expect(await statement.isVisible()).toBe(true);
    const constraints = page.getByRole('region', { name: 'Input constraints' });
    expect(await constraints.isVisible()).toBe(true);
    expect(await constraints.evaluate(el => getComputedStyle(el).borderTopWidth)).toBe('1px');
    expect(await constraints.locator('.daily-constraints-text').evaluate(el => getComputedStyle(el).whiteSpace)).toBe('pre-wrap');
    expect(await constraints.locator('.daily-constraints-text').textContent()).toBe('1 <= n <= 100000\n' + 'C'.repeat(200));
    const bounds = (await constraints.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    expect(await page.locator('.daily-statement').getAttribute('open')).not.toBeNull();
    expect(await statement.evaluate(el => getComputedStyle(el).whiteSpace)).toBe('pre-wrap');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const input = page.getByRole('region', { name: 'Example 1 input', exact: true });
    expect(await input.isVisible()).toBe(true);
    expect(await input.evaluate(el => getComputedStyle(el).overflowX)).toBe('auto');
    await input.focus();
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => input.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await summary.focus();
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
    for (const budget of await page.locator('.password-budget').all()) {
      expect(await budget.textContent()).toContain('0 / 256 bytes');
      expect(await budget.evaluate(el => getComputedStyle(el).borderTopStyle)).toBe('solid');
      const bounds = (await budget.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
    }
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
        const skip = page.getByRole('link', { name: 'Skip to duel' });
        await skip.focus();
        await page.keyboard.press('Enter');
        expect(await page.locator('#main-content').evaluate(el => el === document.activeElement)).toBe(true);
        for (const [label, target] of [['Read problem', '#arena-problem-title'], ['Back to your solution', '#arena-solution-title'], ['Your solution', '#arena-solution-title']]) {
          const link = page.getByRole('link', { name: label, exact: true });
          expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
          await link.focus();
          await page.keyboard.press('Enter');
          expect(await page.locator(target).evaluate(el => el === document.activeElement)).toBe(true);
        }
        const signature = page.getByRole('region', { name: 'Function signature', exact: true });
        expect(await signature.getAttribute('aria-describedby')).toBe('arena-signature-hint');
        expect(await page.locator('#arena-signature-hint').isVisible()).toBe(true);
        expect(await signature.evaluate(el => getComputedStyle(el).whiteSpace)).toBe('pre');
        expect(await signature.evaluate(el => getComputedStyle(el).borderTopWidth)).toBe('1px');
        const constraints = page.getByRole('region', { name: 'Constraints', exact: true });
        expect(await constraints.locator('.arena-text').textContent()).toBe('N'.repeat(200));
        const complexity = constraints.locator('details');
        const summary = complexity.locator('summary');
        expect(await complexity.getAttribute('open')).toBeNull();
        expect((await summary.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        await summary.focus();
        await page.keyboard.press('Enter');
        expect(await complexity.locator('p').first().isVisible()).toBe(true);
        expect(await complexity.textContent()).toContain('about 5 billion comparisons');
        const constraintBounds = (await constraints.boundingBox())!;
        expect(constraintBounds.x).toBeGreaterThanOrEqual(0);
        expect(constraintBounds.x + constraintBounds.width).toBeLessThanOrEqual(width);
        expect(await constraints.evaluate(el => getComputedStyle(el).borderTopWidth)).toBe('1px');
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        await page.keyboard.press('Space');
        expect(await complexity.getAttribute('open')).toBeNull();
        const judging = page.getByRole('complementary', { name: 'How your solution is judged' });
        expect(await judging.isVisible()).toBe(true);
        expect(await judging.locator('ol li').count()).toBe(3);
        const judgingBounds = (await judging.boundingBox())!;
        expect(judgingBounds.x).toBeGreaterThanOrEqual(0);
        expect(judgingBounds.x + judgingBounds.width).toBeLessThanOrEqual(width);
        expect(await judging.evaluate(el => getComputedStyle(el).borderTopWidth)).toBe('1px');
        const guide = page.getByRole('complementary', { name: 'Example format guide' });
        expect(await guide.isVisible()).toBe(true);
        expect(await guide.textContent()).toContain('return its result');
        const guideBounds = (await guide.boundingBox())!;
        expect(guideBounds.x).toBeGreaterThanOrEqual(0);
        expect(guideBounds.x + guideBounds.width).toBeLessThanOrEqual(width);
        expect(await guide.evaluate(el => getComputedStyle(el).borderLeftWidth)).toBe('4px');
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
      for (const selector of ['.rating-axis', '.rating-chart', '.rating-timeline', '.rating-change', '.rating-window-note']) {
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
      const history = page.locator('.rating-history');
      expect(await history.getByRole('list', {name:'Rated duel changes'}).isVisible()).toBe(true);
      expect(await history.locator('time').getAttribute('datetime')).toBe('2026-11-01T00:00:00.000Z');
      expect(await history.locator('.rating-history-change').textContent()).toBe('+434 MMR change');
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      expect(await summary.evaluate(el => el === document.activeElement)).toBe(true);
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

it.each([320, 375, 1280])('guides friends guests with keyboard navigation at %spx', async width => {
  state.signedIn = false;
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  try {
    await page.setContent(`<style>${readFileSync('src/app/globals.css', 'utf8')}</style>${renderToStaticMarkup(await Friends({ searchParams: Promise.resolve({}) }))}`);
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to friends' });
    expect(await skip.evaluate(el => el === document.activeElement)).toBe(true);
    expect((await skip.boundingBox())!.y).toBeGreaterThanOrEqual(0);
    await page.keyboard.press('Enter');
    expect(await page.getByRole('main').evaluate(el => el === document.activeElement)).toBe(true);
    const actions = page.locator('.ladder-empty-actions a');
    expect(await actions.count()).toBe(2);
    for (const action of await actions.all()) {
      await page.keyboard.press('Tab');
      expect(await action.evaluate(el => el === document.activeElement)).toBe(true);
      expect((await action.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      if (width <= 480) expect(Math.round((await action.boundingBox())!.width)).toBe(Math.round((await actions.first().boundingBox())!.width));
    }
    expect(await page.getByRole('heading', { name: 'Keep your rivals close.' }).isVisible()).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  } finally { state.signedIn = true; await page.close(); }
});

it.each([320, 375, 1280])('supports direct account entry and error recovery at %spx', async width => {
  state.signedIn = false;
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  try {
    await page.setContent(`<style>${readFileSync('src/app/globals.css', 'utf8')}</style>${renderToStaticMarkup(await Account({ searchParams: Promise.resolve({ error: 'Incorrect username or password.' }) }))}`);
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to account' });
    expect(await skip.evaluate(el => el === document.activeElement)).toBe(true);
    expect((await skip.boundingBox())!.y).toBeGreaterThanOrEqual(0);
    await page.keyboard.press('Enter');
    expect(await page.getByRole('main').evaluate(el => el === document.activeElement)).toBe(true);
    await page.keyboard.press('Tab');
    const login = page.getByRole('link', { name: 'Go to sign in' });
    expect(await login.evaluate(el => el === document.activeElement)).toBe(true);
    await page.keyboard.press('Tab');
    const signup = page.getByRole('link', { name: 'Go to create account' });
    expect(await signup.evaluate(el => el === document.activeElement)).toBe(true);
    for (const link of [login, signup]) expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.keyboard.press('Enter');
    expect(await page.getByRole('heading', { name: 'Create your player' }).evaluate(el => el === document.activeElement)).toBe(true);
    await page.keyboard.press('Tab');
    const form = page.getByRole('form', { name: 'Create your player' });
    expect(await form.getByRole('textbox', { name: 'Username', exact: true }).evaluate(el => el === document.activeElement)).toBe(true);
    await login.focus();
    await page.keyboard.press('Enter');
    expect(await page.getByRole('heading', { name: 'Welcome back' }).evaluate(el => el === document.activeElement)).toBe(true);
    await page.keyboard.press('Tab');
    expect(await page.getByRole('form', { name: 'Welcome back' }).getByRole('textbox', { name: 'Username', exact: true }).evaluate(el => el === document.activeElement)).toBe(true);
    expect(await page.getByRole('alert').isVisible()).toBe(true);
    expect(await page.getByRole('alert').textContent()).toContain('Check both credentials');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  } finally { state.signedIn = true; await page.close(); }
});
it.each([320, 375, 1280])('keeps empty public ladder actions readable and keyboard accessible at %spx', async width => {
  state.leaderboardEmpty = true;
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  try {
    for (const period of ['global', 'weekly']) {
      await page.setContent(`<style>${readFileSync('src/app/globals.css', 'utf8')}</style>${renderToStaticMarkup(await Leaderboard({ searchParams: Promise.resolve({ period }) }))}`);
      const actions = page.locator('.ladder-empty-actions a');
      expect(await actions.count()).toBe(2);
      await actions.first().focus();
      expect(await actions.first().evaluate(el => el === document.activeElement)).toBe(true);
      await page.keyboard.press('Tab');
      expect(await actions.last().evaluate(el => el === document.activeElement)).toBe(true);
      for (const action of await actions.all()) {
        const bounds = (await action.boundingBox())!;
        expect(bounds.height).toBeGreaterThanOrEqual(44);
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
  } finally { state.leaderboardEmpty = false; await page.close(); }
});

it.each([320, 375, 1280])('makes empty public profile guidance usable at %spx', async width => {
  state.profileEmpty = true;
  const page = await browser.newPage({viewport:{width,height:900}});
  try {
    await page.setContent(`<style>${readFileSync('src/app/globals.css','utf8')}</style>${renderToStaticMarkup(await Profile({params:Promise.resolve({username})}))}`);
    const region = page.getByRole('region',{name:'No completed duels yet'});
    const play = region.getByRole('link',{name:'Find a duel'});
    const standings = region.getByRole('link',{name:'Explore standings'});
    await play.focus();
    await page.keyboard.press('Tab');
    expect(await standings.evaluate(el => el === document.activeElement)).toBe(true);
    for (const action of [play, standings]) expect((await action.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await page.getByRole('table').count()).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  } finally {state.profileEmpty = false; await page.close();}
});

it.each([320, 375, 1280])('distinguishes all home outcomes without overflow at %spx', async width => {
  state.homeOutcomes = true;
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  try {
    await page.setContent(`<style>${readFileSync('src/app/globals.css', 'utf8')}</style>${renderToStaticMarkup(await Home())}`);
    const colors = [];
    for (const outcome of ['win', 'loss', 'draw']) {
      const badge = page.locator(`.recent-duels .history-result--${outcome}`);
      expect(await badge.textContent()).toBe(outcome.toUpperCase());
      expect(await badge.isVisible()).toBe(true);
      expect(await badge.evaluate(el => getComputedStyle(el).borderTopStyle)).toBe('solid');
      colors.push(await badge.evaluate(el => getComputedStyle(el).color));
      const row = badge.locator('..');
      const result = row.locator('.recent-duel-result');
      const opponent = row.locator('.recent-duel-opponent');
      await result.focus();
      await page.keyboard.press('Tab');
      expect(await opponent.evaluate(el => el === document.activeElement)).toBe(true);
      expect((await result.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      expect((await opponent.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    expect(new Set(colors).size).toBe(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  } finally { state.homeOutcomes = false; await page.close(); }
});

it.each([320, 375, 1280])('keeps home readiness guidance readable at %spx', async width => {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  try {
    await page.setContent(`<style>${readFileSync('src/app/globals.css', 'utf8')}</style>${renderToStaticMarkup(await Home())}`);
    const guide = page.getByRole('complementary', { name: 'Before your first duel' });
    expect(await guide.isVisible()).toBe(true);
    expect(await guide.textContent()).toContain('60 seconds to click Ready');
    const lengths = guide.locator('dl');
    expect(await lengths.getAttribute('aria-label')).toBe('Duel lengths by difficulty');
    expect(await lengths.locator('dt').allTextContents()).toEqual(['Easy', 'Medium', 'Hard']);
    expect(await lengths.locator('strong').allTextContents()).toEqual(['5 minutes', '15 minutes', '30 minutes']);
    for (const row of await lengths.locator(':scope > div').all()) {
      expect(await row.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      expect(await row.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(38, 36, 33)');
      const bounds = (await row.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    }
    expect(await guide.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect(await guide.evaluate(el => getComputedStyle(el).borderTopStyle)).toBe('solid');
    expect(await guide.locator('p').first().evaluate(el => parseFloat(getComputedStyle(el).lineHeight))).toBeGreaterThanOrEqual(22);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  } finally { await page.close(); }
});

it.each([320, 375, 1280])('keeps profile record totals and win rate readable at %spx', async width => {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  try {
    await page.setContent(`<style>${readFileSync('src/app/globals.css', 'utf8')}</style>${renderToStaticMarkup(await Profile({ params: Promise.resolve({ username }) }))}`);
    const record = page.getByRole('region', { name: 'All-time match record' });
    expect(await record.getByText('299997 completed duels', { exact: true }).isVisible()).toBe(true);
    expect(await record.getByText('33.3% win rate', { exact: true }).isVisible()).toBe(true);
    expect(await record.getByRole('term').allTextContents()).toEqual(['Wins', 'Losses', 'Draws']);
    for (const card of await record.locator('.card').all()) {
      expect(await card.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  } finally { await page.close(); }
});

it.each([320, 375, 1280])('keeps the standings summary readable at %spx', async width => {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  try {
    await page.setContent(`<style>${readFileSync('src/app/globals.css', 'utf8')}</style>${renderToStaticMarkup(await Leaderboard({ searchParams: Promise.resolve({ period: 'weekly', scope: 'friends' }) }))}`);
    const summary = page.getByRole('region', { name: 'Weekly climb', exact: true });
    expect(await summary.isVisible()).toBe(true);
    expect(await summary.textContent()).toContain('1 player shown');
    expect(await summary.textContent()).toContain('YOUR CIRCLE');
    expect(await summary.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  } finally { await page.close(); }
});

it.each([320, 375, 1280])('scrolls daily signatures with the keyboard at %spx', async width => {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  try {
    await page.setContent(`<style>${readFileSync('src/app/globals.css', 'utf8')}</style>${renderToStaticMarkup(await Home())}`);
    const signature = page.getByRole('region', { name: 'Daily challenge function signature' });
    expect(await page.locator('#daily-signature-hint').isVisible()).toBe(true);
    expect(await signature.getAttribute('aria-describedby')).toBe('daily-signature-hint');
    expect(await signature.evaluate(el => getComputedStyle(el).whiteSpace)).toBe('pre');
    expect(await signature.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
    await signature.focus();
    expect(await signature.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => signature.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
    await page.keyboard.press('Tab');
    expect(await page.locator('.daily-statement summary').evaluate(el => el === document.activeElement)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  } finally { await page.close(); }
});
it.each([320, 375, 1280])('keeps friend action recovery feedback readable at %spx', async width => {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  try {
    await page.setContent(`<style>${readFileSync('src/app/globals.css', 'utf8')}</style>${renderToStaticMarkup(await Friends({ searchParams: Promise.resolve({ message: 'Friends unavailable. Please try again later.' }) }))}`);
    const feedback = page.locator('.friend-feedback');
    expect(await feedback.getByRole('heading', { name: 'Action could not be confirmed' }).isVisible()).toBe(true);
    expect(await feedback.textContent()).toContain('before trying again');
    expect(await feedback.evaluate(el => getComputedStyle(el).borderLeftWidth)).toBe('4px');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('link', { name: 'Skip to friends' }).focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    const refresh = page.getByRole('link', {name:'Refresh friends'});
    expect(await refresh.evaluate(el => el === document.activeElement)).toBe(true);
    expect(await refresh.getAttribute('href')).toBe('/friends');
    expect((await refresh.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await page.locator('.friend-refresh').textContent()).toContain('reflect when this page loaded');
    await page.keyboard.press('Tab');
    expect(await page.getByRole('navigation', {name:'Friend sections'}).getByRole('link', {name:'Invite a player'}).evaluate(el => el === document.activeElement)).toBe(true);
    for (const title of ['Incoming requests', 'Your friends', 'Sent requests']) {
      await page.keyboard.press('Tab');
      expect(await page.getByRole('navigation', {name:'Friend sections'}).getByRole('link', {name:`${title} 1`}).evaluate(el => el === document.activeElement)).toBe(true);
    }
    await page.keyboard.press('Tab');
    expect(await page.getByLabel('Player username').evaluate(el => el === document.activeElement)).toBe(true);
  } finally { await page.close(); }
});

it.each([320, 375, 1280])('keeps ordered scoring cards readable at %spx', async width => {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  try {
    await page.setContent(`<style>${readFileSync('src/app/globals.css', 'utf8')}</style>${renderToStaticMarkup(await Home())}`);
    const rules = page.getByRole('list', { name: 'Duel scoring priority' });
    expect(await rules.locator(':scope > li').count()).toBe(3);
    expect(await rules.textContent()).toContain('median of three runs');
    const cards = await rules.locator(':scope > li').all();
    const bounds = [];
    for (const card of cards) {
      const box = (await card.boundingBox())!;
      bounds.push(box);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(await card.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(49, 46, 43)');
    }
    if (width < 760) expect(bounds[1].y).toBeGreaterThanOrEqual(bounds[0].y + bounds[0].height);
    else expect(bounds[1].x).toBeGreaterThan(bounds[0].x);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  } finally { await page.close(); }
});

it.each([320, 375, 1280])('keeps the weekly scoring guide readable at %spx', async width => {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  try {
    await page.setContent(`<style>${readFileSync('src/app/globals.css', 'utf8')}</style>${renderToStaticMarkup(await Leaderboard({ searchParams: Promise.resolve({period:'weekly'}) }))}`);
    const guide = page.getByRole('region', { name: 'How the weekly climb works' });
    expect(await guide.isVisible()).toBe(true);
    expect(await guide.locator('dt').allTextContents()).toEqual(['Weekly gain', 'Every rated result counts', 'Current rating']);
    for (const row of await guide.locator('dl > div').all()) {
      expect(await row.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      expect(await row.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(38, 36, 33)');
      const bounds = (await row.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    }
    const rows = await guide.locator('dl > div').all();
    const first = (await rows[0].boundingBox())!;
    const second = (await rows[1].boundingBox())!;
    if (width < 400) expect(second.y).toBeGreaterThan(first.y);
    else expect(second.y).toBe(first.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  } finally { await page.close(); }
});


it.each([320, 375, 1280])('keeps standings tier badges readable at %spx', async width => {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  try {
    await page.setContent(`<style>${readFileSync('src/app/globals.css', 'utf8')}</style>${renderToStaticMarkup(await Leaderboard({searchParams:Promise.resolve({period:'weekly'})}))}`);
    const rating = page.locator('.standings-rating');
    expect(await rating.textContent()).toBe('1234 MMRGold');
    const badge = rating.locator('.badge');
    expect(await badge.isVisible()).toBe(true);
    expect(await rating.evaluate(el => getComputedStyle(el).flexDirection)).toBe('column');
    const cell = (await rating.boundingBox())!;
    const bounds = (await badge.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(cell.x);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(cell.x + cell.width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  } finally { await page.close(); }
});


it.each([320, 375, 1280])('keeps the home rating tier readable at %spx', async width => {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  try {
    await page.setContent(`<style>${readFileSync('src/app/globals.css', 'utf8')}</style>${renderToStaticMarkup(await Home())}`);
    const card = page.locator('.home-ladder');
    const badge = card.locator('.badge');
    expect(await badge.textContent()).toBe('Bronze');
    expect(await badge.isVisible()).toBe(true);
    expect(await card.textContent()).toContain('Displayed ratings are rounded.');
    const streak = card.locator('.home-streak');
    expect(await streak.isVisible()).toBe(true);
    expect(await streak.textContent()).toContain('A loss or draw resets the count');
    expect(await streak.locator('dd').textContent()).toBe('0 consecutive wins');
    expect(await streak.evaluate(el => getComputedStyle(el).borderTopStyle)).toBe('solid');
    expect(await streak.locator('p').first().evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    const outer = (await card.boundingBox())!;
    const inner = (await badge.boundingBox())!;
    expect(inner.x).toBeGreaterThanOrEqual(outer.x);
    expect(inner.x + inner.width).toBeLessThanOrEqual(outer.x + outer.width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  } finally { await page.close(); }
});

it.each([320, 375, 1280])('makes home history navigation visible to keyboard and touch at %spx', async width => {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  try {
    await page.setContent(`<style>${readFileSync('src/app/globals.css', 'utf8')}</style>${renderToStaticMarkup(await Home())}`);
    const link = page.getByRole('link', { name: 'View your duel history', exact: true });
    expect(await link.getAttribute('href')).toBe(`/profile/${username}`);
    await link.focus();
    expect(await link.evaluate(el => el === document.activeElement)).toBe(true);
    expect(await link.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
    const bounds = (await link.boundingBox())!;
    expect(bounds.height).toBeGreaterThanOrEqual(44);
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  } finally { await page.close(); }
});

it.each([320, 375, 1280])('keeps recent duel completion times readable at %spx', async width => {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  try {
    await page.setContent(`<style>${readFileSync('src/app/globals.css', 'utf8')}</style>${renderToStaticMarkup(await Home())}`);
    const date = page.locator('.recent-duels time');
    expect(await date.textContent()).toBe('Nov 6, 2026, 23:05 UTC');
    expect(await date.getAttribute('datetime')).toBe('2026-11-06T23:05:00.000Z');
    expect(await date.isVisible()).toBe(true);
    const bounds = (await date.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  } finally { await page.close(); }
});
it.each([320, 375, 1280])('keeps profile completion timestamps inside the scrollable history at %spx', async width => {
  const page = await browser.newPage({viewport:{width,height:900}});
  try {
    await page.setContent(`<style>${readFileSync('src/app/globals.css','utf8')}</style>${renderToStaticMarkup(await Profile({params:Promise.resolve({username})}))}`);
    const region = page.getByRole('region',{name:'Recent duel history'});
    await region.focus();
    await region.evaluate(el => { el.scrollLeft = el.scrollWidth; });
    const date = region.locator('.duel-date');
    expect(await date.textContent()).toContain('Nov 1, 2026, 00:00 UTC');
    expect(await date.locator('time').getAttribute('datetime')).toBe('2026-11-01T00:00:00.000Z');
    const bounds = (await date.boundingBox())!;
    const frame = (await region.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(frame.x);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(frame.x + frame.width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  } finally { await page.close(); }
});

it.each([320,375,1280])('makes completed problem review keyboard accessible at %spx',async width=>{
 const page=await browser.newPage({viewport:{width,height:900}});
 try {
  await page.setContent(`<style>${readFileSync('src/app/globals.css','utf8')}</style>${renderToStaticMarkup(<Results matchId="saved-duel" result={{title:'Sample',outcome:'DRAW',players:[]}}/>)}`);
  const panel=page.getByRole('region',{name:'Learn from this duel'});
  const link=page.getByRole('link',{name:'Review problem'});
  expect(await link.getAttribute('href')).toBe('/match/saved-duel');
  await link.focus();
  expect(await link.evaluate(el=>el===document.activeElement)).toBe(true);
  expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  for(const item of [panel,link]) {
   const box=(await item.boundingBox())!;
   expect(box.x).toBeGreaterThanOrEqual(0);
   expect(box.x+box.width).toBeLessThanOrEqual(width);
  }
  expect(await panel.evaluate(el=>getComputedStyle(el).borderLeftStyle)).toBe('solid');
 } finally {await page.close();}
});

it.each([320,375,1280])('keeps no-judged-submission guidance readable at %spx',async width=>{
 const page=await browser.newPage({viewport:{width,height:900}});
 try {
  await page.setContent(`<style>${readFileSync('src/app/globals.css','utf8')}</style>${renderToStaticMarkup(<Results result={{title:'Sample',outcome:'DRAW',players:[{username:'Ada',before:800,after:800,passed:0,total:8,cpu:1000,submitted:null}]}}/>)}`);
  const notice=page.locator('.result-no-submission');
  expect(await notice.textContent()).toContain('No judged submission');
  expect(await notice.evaluate(el=>getComputedStyle(el).borderLeftStyle)).toBe('solid');
  const box=(await notice.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x+box.width).toBeLessThanOrEqual(width);
  expect(await page.getByRole('progressbar').count()).toBe(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 } finally {await page.close();}
});

it.each([320, 375, 1280])('keeps home rating changes styled and contained at %spx', async width => {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  try {
    await page.setContent(`<style>${readFileSync('src/app/globals.css', 'utf8')}</style>${renderToStaticMarkup(await Home())}`);
    const change = page.locator('.home-rating-change').last();
    expect(await change.textContent()).toBe('+13 MMR change');
    expect(await change.isVisible()).toBe(true);
    expect(await change.evaluate(el => getComputedStyle(el).fontWeight)).toBe('700');
    const bounds = (await change.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  } finally { await page.close(); }
});
import { PlainPythonEditor } from '../src/components/plain-python-editor';

it.each([false, true])('keeps the plain editor keyboard guide usable on phones (readOnly=%s)', async readOnly => {
  const page = await browser.newPage({ viewport: { width: 320, height: 900 } });
  try {
    await page.setContent(`<style>${readFileSync('src/app/globals.css', 'utf8')}</style><main>${renderToStaticMarkup(<PlainPythonEditor value={'    return 1'} onChange={() => {}} readOnly={readOnly} />)}</main>`);
    const summary = page.locator('.editor-keyboard-guide summary');
    const guide = page.locator('.editor-keyboard-guide .editor-hint');
    const editor = page.getByRole('textbox', { name: 'Python solution' });
    expect(await guide.isVisible()).toBe(false);
    expect(await editor.getAttribute('aria-describedby')).toContain(await guide.getAttribute('id'));
    expect((await summary.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await summary.focus();
    await page.keyboard.press('Enter');
    expect(await guide.isVisible()).toBe(true);
    expect(await summary.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
    expect(await guide.textContent()).toContain(readOnly ? 'This solution is read-only.' : 'Enter keeps indentation');
    expect(await guide.textContent()).toContain('Tab moves to the next control.');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    await page.keyboard.press('Space');
    expect(await guide.isVisible()).toBe(false);
    expect(await editor.inputValue()).toBe('    return 1');
  } finally { await page.close(); }
});

it.each([320, 375, 1280])('links empty friend sections to the invitation form at %spx', async width => {
  const page = await browser.newPage({ viewport: { width, height: 600 } });
  state.friendsEmpty = true;
  try {
    await page.setContent(`<style>${readFileSync('src/app/globals.css', 'utf8')}</style>${renderToStaticMarkup(await Friends({searchParams:Promise.resolve({})}))}`);
    const action = page.getByRole('region', {name:'Your friends 0'}).getByRole('link', {name:'Invite a player'});
    expect((await action.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await action.focus();
    await page.keyboard.press('Enter');
    expect(await page.locator('#friend-invite').evaluate(el => el === document.activeElement)).toBe(true);
    await page.keyboard.press('Tab');
    expect(await page.getByRole('textbox', {name:'Player username'}).evaluate(el => el === document.activeElement)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  } finally { state.friendsEmpty = false; await page.close(); }
});
