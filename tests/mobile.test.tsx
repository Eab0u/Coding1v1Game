import { readFileSync } from 'node:fs';
import { chromium, type Browser } from '@playwright/test';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';

const username = 'abcdefghijklmnopqrstuvwx';
const state = vi.hoisted(() => ({ signedIn: true }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock('../src/lib/auth-server', () => ({ database: () => ({}), auth: { current: async () => state.signedIn ? ({ id: '1', username: 'abcdefghijklmnopqrstuvwx', rating: 800 }) : null } }));
vi.mock('../src/lib/home', () => ({ loadHome: async () => ({ streak: 0, daily: { title: 'A'.repeat(120), statement: 'B'.repeat(200), function_signature: 'def solve_very_long_function_name(values: list[int]) -> list[int]:', difficulty: 'easy' }, recent: [{ id: '1', title: 'C'.repeat(120), opponent: 'abcdefghijklmnopqrstuvwx', winner_id: '1' }] }) }));
vi.mock('../src/lib/leaderboard', () => ({ loadLeaderboard: async () => [{ username: 'abcdefghijklmnopqrstuvwx', rating: 1234, score: 123, rank: 1 }] }));
vi.mock('../src/lib/profile', () => ({ ratingTier: () => 'Bronze', loadProfile: async () => ({ username: 'abcdefghijklmnopqrstuvwx', rating: 800, record: { wins: 99999, losses: 99999, draws: 99999 }, ratings: [], history: [{ id: '1', opponent: 'abcdefghijklmnopqrstuvwx', title: 'D'.repeat(120), result: 'WIN', delta: 12, completed_at: new Date('2026-11-01Z') }] }) }));
import Home from '../src/app/page';
import Profile from '../src/app/profile/[username]/page';
import Leaderboard from '../src/app/leaderboard/page';
import Account from '../src/app/account/page';

let browser: Browser;
beforeAll(async () => { browser = await chromium.launch(); });
afterAll(async () => { await browser?.close(); });

it('keeps populated pages within phone, tablet and desktop viewports with usable scroll regions', async () => {
  const pages = [await Home(), await Profile({ params: Promise.resolve({ username }) }), await Leaderboard({ searchParams: Promise.resolve({ period: 'weekly' }) }), await Account({ searchParams: Promise.resolve({}) })];
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
            await page.waitForTimeout(150);
            expect(await region.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
          }
        }
        for (const button of await page.locator('.button, .site-header a').all()) {
          expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        }
      }
    }
  } finally { await page.close(); }
}, 30000);
