import { expect, test, type Page } from '@playwright/test';

// Browser-protocol touch input, not DOM or game-state mutation. This emulates a
// touchscreen in Chromium; it is deliberately not reported as iPhone Safari QA.
async function swipe(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  const input = await page.context().newCDPSession(page);
  await input.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ ...from, id: 1 }],
  });
  await input.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ ...to, id: 1 }],
  });
  await input.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await input.detach();
}

async function start(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /プレイ開始/ }).click();
  await page.clock.runFor(100);
  await expect(page.getByTestId('board')).toHaveAttribute(
    'data-status',
    'playing',
  );
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-07T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-07T00:00:01Z'));
});

test('short portrait: board and thumb controls fit, one swipe steers, pending turn is visible', async ({
  page,
}, info) => {
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 664 },
  ]) {
    await page.setViewportSize(viewport);
    await start(page);
    for (const selector of ['.board', '.touch-controls', '.dpad']) {
      const bounds = await page.locator(selector).boundingBox();
      expect(bounds, selector).not.toBeNull();
      expect(bounds!.x, selector).toBeGreaterThanOrEqual(0);
      expect(bounds!.y, selector).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width, selector).toBeLessThanOrEqual(
        viewport.width + 1,
      );
      expect(bounds!.y + bounds!.height, selector).toBeLessThanOrEqual(
        viewport.height + 1,
      );
      if (selector === '.board')
        expect(Math.abs(bounds!.width - bounds!.height)).toBeLessThanOrEqual(1);
    }
    for (const button of await page
      .locator('.direction, .skill-buttons button')
      .all()) {
      const bounds = await button.boundingBox();
      expect(bounds!.width).toBeGreaterThanOrEqual(44);
      expect(bounds!.height).toBeGreaterThanOrEqual(44);
    }
    const board = page.getByTestId('board');
    const arena = (await board.boundingBox())!;
    const origin = {
      x: arena.x + arena.width / 2 - 40,
      y: arena.y + arena.height / 2,
    };
    const scrollBefore = await page.evaluate(() => window.scrollY);
    await swipe(page, origin, { x: origin.x + 80, y: origin.y });
    await expect(
      page.getByRole('button', { name: '右', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('direction-hint')).toBeVisible();
    for (let step = 0; step < 10; step++) {
      if ((await board.getAttribute('data-x')) === '2') break;
      await page.clock.runFor(30);
    }
    await expect(board).toHaveAttribute('data-x', '2');
    // x=2,y=1 has a wall immediately below. The visible pending command must
    // survive that wall and take the next legal down turn at x=3.
    await swipe(page, origin, { x: origin.x, y: origin.y + 70 });
    await expect(
      page.getByRole('button', { name: '下', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await page.clock.runFor(310);
    expect(Number(await board.getAttribute('data-y'))).toBeGreaterThan(1);
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.getByRole('button', { name: '停止', exact: true }).click();
    const position = await board.getAttribute('data-y');
    await page.clock.runFor(400);
    await expect(board).toHaveAttribute('data-y', position!);
    await page.screenshot({
      path: `docs/screenshots/v2-${info.project.name}-${viewport.width}x${viewport.height}-touch.png`,
    });
  }
});

test('touch cancellation and a second finger cannot fire skills or steer; rotation and visibility pause', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 664 });
  await start(page);
  const input = await page.context().newCDPSession(page);
  const dash = await page
    .getByRole('button', { name: /↗ ダッシュ/ })
    .boundingBox();
  const energyBefore = await page.locator('#energy').getAttribute('value');
  await input.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: dash!.x + 20, y: dash!.y + 20, id: 1 }],
  });
  await input.send('Input.dispatchTouchEvent', {
    type: 'touchCancel',
    touchPoints: [],
  });
  expect(await page.locator('#energy').getAttribute('value')).toBe(
    energyBefore,
  );
  await expect(page.getByTestId('cooldown')).not.toContainText('回復まで');

  const board = page.getByTestId('board');
  const bounds = (await board.boundingBox())!;
  const first = { x: bounds.x + 50, y: bounds.y + 50, id: 2 };
  const second = { x: bounds.x + 120, y: bounds.y + 50, id: 3 };
  await input.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [first],
  });
  await input.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [first, second],
  });
  await input.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [first, { ...second, y: second.y + 70 }],
  });
  await input.send('Input.dispatchTouchEvent', {
    type: 'touchCancel',
    touchPoints: [],
  });
  await input.detach();
  await page.clock.runFor(350);
  await expect(board).toHaveAttribute('data-x', '1');
  await expect(board).toHaveAttribute('data-y', '1');

  await page.setViewportSize({ width: 664, height: 390 });
  await page.clock.runFor(100);
  await expect(board).toHaveAttribute('data-status', 'paused');
  const pausedTime = await page.getByTestId('time').textContent();
  await page.setViewportSize({ width: 390, height: 664 });
  await page.clock.runFor(2000);
  await expect(page.getByTestId('time')).toHaveText(pausedTime!);
  await page.getByRole('button', { name: 'プレイを再開' }).click();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.runFor(100);
  await expect(board).toHaveAttribute('data-status', 'paused');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.runFor(2000);
  await expect(board).toHaveAttribute('data-status', 'paused');
  await page.getByRole('button', { name: 'プレイを再開' }).click();
  await expect(board).toHaveAttribute('data-status', 'playing');
});

test('daily course and sound preferences survive reload without replacing earned records', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 664 });
  await start(page);
  const classicWalls = await page
    .locator('[data-wall]')
    .evaluateAll((walls) =>
      walls.map((wall) => wall.getAttribute('data-wall')),
    );
  await page.getByRole('button', { name: '右', exact: true }).click();
  await page.clock.runFor(450);
  await page.getByRole('button', { name: '停止', exact: true }).click();
  await page.clock.runFor(60000);
  await expect(page.getByTestId('board')).toHaveAttribute(
    'data-status',
    'lost',
  );
  const score = Number(await page.getByTestId('score').textContent());
  expect(score).toBeGreaterThan(0);
  const earned = await page.evaluate(() =>
    localStorage.getItem('sat-shubo-arcade:v1'),
  );
  expect(JSON.parse(earned!).runs).toBe(1);
  await page.getByRole('button', { name: '別のコース・設定を選ぶ' }).click();
  const sound = page.getByRole('button', { name: 'サウンド', exact: true });
  const previousSound = await sound.getAttribute('aria-pressed');
  await sound.click();
  await expect(sound).toHaveAttribute(
    'aria-pressed',
    String(previousSound !== 'true'),
  );
  await page.getByRole('button', { name: '今日のコース', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '今日のコース', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  const dailySeed = await page
    .getByLabel('コース番号', { exact: true })
    .inputValue();
  await page.reload();
  await expect(sound).toHaveAttribute(
    'aria-pressed',
    String(previousSound !== 'true'),
  );
  await expect(
    page.getByRole('button', { name: '今日のコース', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('コース番号', { exact: true })).toHaveValue(
    dailySeed,
  );
  await expect(page.getByTestId('best-middle')).toHaveText(String(score));
  expect(
    await page.evaluate(() => localStorage.getItem('sat-shubo-arcade:v1')),
  ).toBe(earned);
  // High density fills every open path. Daily play needs changed geometry,
  // rather than only a different chance of placing each sugar.
  await page.getByRole('button', { name: /高め ×/ }).click();
  await page.getByRole('button', { name: /プレイ開始/ }).click();
  const dailyWalls = await page
    .locator('[data-wall]')
    .evaluateAll((walls) =>
      walls.map((wall) => wall.getAttribute('data-wall')),
    );
  expect(dailyWalls).not.toEqual(classicWalls);
  await page.getByRole('button', { name: '一時停止', exact: true }).click();
  await page.getByRole('button', { name: 'このプレイをやめる' }).click();
  await page.getByRole('button', { name: /プレイ開始/ }).click();
  expect(
    await page
      .locator('[data-wall]')
      .evaluateAll((walls) =>
        walls.map((wall) => wall.getAttribute('data-wall')),
      ),
  ).toEqual(dailyWalls);
  expect(
    await page.evaluate(() => localStorage.getItem('sat-shubo-arcade:v1')),
  ).toBe(earned);
});
