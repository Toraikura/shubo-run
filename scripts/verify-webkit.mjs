import { webkit } from 'playwright-core';
import { expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Usage: node scripts/verify-webkit.mjs [url]
// Requires `npx playwright install webkit` and an already-built preview server.
// This is desktop WebKit with a touch viewport, not an actual iPhone/Safari.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'test-results', 'webkit-smoke');
const url = process.argv[2] || 'http://127.0.0.1:4187/';
await mkdir(output, { recursive: true });
const results = {
  url,
  testedAt: new Date().toISOString(),
  engine: 'Playwright WebKit with touch emulation; not a real iPhone',
  viewports: [],
};

async function visibleBounds(page, selector, viewport) {
  const bounds = await page.locator(selector).boundingBox();
  expect(bounds, `${selector} exists`).not.toBeNull();
  expect(bounds.x, `${selector} left`).toBeGreaterThanOrEqual(-1);
  expect(bounds.y, `${selector} top`).toBeGreaterThanOrEqual(-1);
  expect(bounds.x + bounds.width, `${selector} right`).toBeLessThanOrEqual(viewport.width + 1);
  expect(bounds.y + bounds.height, `${selector} bottom`).toBeLessThanOrEqual(viewport.height + 1);
  return bounds;
}

const browser = await webkit.launch({ headless: true });
try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }]) {
    const name = `${viewport.width}x${viewport.height}`;
    const result = { viewport, status: 'running', bounds: {}, checks: [], errors: [] };
    results.viewports.push(result);
    const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.on('pageerror', error => result.errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') result.errors.push(message.text());
    });
    page.on('requestfailed', request => result.errors.push(`${request.url()}: ${request.failure()?.errorText}`));
    try {
      await page.goto(url, { waitUntil: 'networkidle' });
      const board = page.getByTestId('board');
      await expect(board).toHaveAttribute('data-status', 'ready');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: path.join(output, `${name}-initial.png`), fullPage: true });
      result.checks.push('initial page loads without horizontal overflow');

      // Real time and actual touchscreen taps: no clock or model-state mutation.
      const sound = page.getByRole('button', { name: 'サウンド', exact: true });
      await expect(sound).toHaveAttribute('aria-pressed', 'false');
      await sound.tap();
      await expect(sound).toHaveAttribute('aria-pressed', 'true');
      await page.getByRole('button', { name: 'プレイ開始', exact: true }).tap();
      await expect(board).toHaveAttribute('data-status', 'playing');
      for (const selector of ['.field', '.board', '.touch-controls', '.dpad']) {
        result.bounds[selector] = await visibleBounds(page, selector, viewport);
      }
      for (const button of await page.locator('.direction, .skill-buttons button').all()) {
        const bounds = await button.boundingBox();
        expect(bounds.width).toBeGreaterThanOrEqual(44);
        expect(bounds.height).toBeGreaterThanOrEqual(44);
      }
      result.checks.push('active board and thumb controls fit; direction and skill targets >=44px');
      await page.getByRole('button', { name: '右', exact: true }).tap();
      await expect.poll(async () => Number(await board.getAttribute('data-x')), { timeout: 3000 }).toBeGreaterThan(1);
      await page.getByRole('button', { name: '停止', exact: true }).tap();
      const x = await board.getAttribute('data-x');
      await page.waitForTimeout(400);
      await expect(board).toHaveAttribute('data-x', x);
      await page.getByRole('button', { name: /ダッシュ/ }).tap();
      await expect(page.getByTestId('cooldown')).toContainText('回復まで');
      await page.screenshot({ path: path.join(output, `${name}-active.png`) });
      result.checks.push('real-time touch move, stop, and dash work');

      await page.getByRole('button', { name: '一時停止', exact: true }).tap();
      await expect(board).toHaveAttribute('data-status', 'paused');
      const pausedTime = await page.getByTestId('time').textContent();
      await page.waitForTimeout(1300);
      await expect(page.getByTestId('time')).toHaveText(pausedTime);
      await page.getByRole('button', { name: /プレイを再開/ }).tap();
      await expect(board).toHaveAttribute('data-status', 'playing');
      await expect(page.getByTestId('time')).not.toHaveText(pausedTime, { timeout: 2500 });
      result.checks.push('pause freezes real time and explicit resume restarts it');

      await sound.tap();
      await expect(sound).toHaveAttribute('aria-pressed', 'false');
      await page.getByRole('button', { name: '一時停止', exact: true }).tap();
      await page.getByRole('button', { name: 'このプレイをやめる', exact: true }).tap();
      await page.getByRole('button', { name: '今日のコース', exact: true }).tap();
      await expect(page.getByRole('button', { name: '今日のコース', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await sound.tap();
      await page.reload({ waitUntil: 'networkidle' });
      await expect(sound).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByRole('button', { name: '今日のコース', exact: true })).toHaveAttribute('aria-pressed', 'true');
      result.checks.push('sound opt-in/toggle and daily-course preference survive reload');

      // Clock control only advances normal game frames. No victory/loss injection.
      await page.clock.install({ time: new Date('2026-09-12T00:00:00Z') });
      await page.clock.pauseAt(new Date('2026-09-12T00:00:01Z'));
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'プレイ開始', exact: true }).tap();
      await page.clock.runFor(61000);
      await expect(board).toHaveAttribute('data-status', 'lost');
      await page.screenshot({ path: path.join(output, `${name}-result.png`) });
      await page.getByRole('button', { name: /同じコースで再挑戦/ }).tap();
      await expect(board).toHaveAttribute('data-status', 'playing');
      await expect(board).toHaveAttribute('data-hp', '3');
      await visibleBounds(page, '.board', viewport);
      await visibleBounds(page, '.touch-controls', viewport);
      result.checks.push('normal clock-driven loss and touch retry restore playable state');
      expect(result.errors).toEqual([]);
      result.status = 'passed';
      process.stdout.write(`PASS WebKit ${name}: ${result.checks.length} checks\n`);
    } catch (error) {
      result.status = 'failed';
      result.failure = error.stack || String(error);
      await page.screenshot({ path: path.join(output, `${name}-failure.png`), fullPage: true }).catch(() => {});
      process.stderr.write(`FAIL WebKit ${name}: ${error.message}\n`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
  results.status = results.viewports.every(result => result.status === 'passed') ? 'passed' : 'failed';
  await writeFile(path.join(output, 'results.json'), `${JSON.stringify(results, null, 2)}\n`);
}
if (results.status !== 'passed') process.exitCode = 1;
