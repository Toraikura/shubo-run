import { test, expect, type Page } from '@playwright/test';
const arrows = {
  up: 'ArrowUp',
  right: 'ArrowRight',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  stop: 'x',
} as const;
const labels = {
  up: '上',
  right: '右',
  down: '下',
  left: '左',
  stop: '停止',
} as const;
type Direction = keyof typeof arrows;
async function command(page: Page, d: Direction, touch: boolean) {
  if (touch)
    await page.getByRole('button', { name: labels[d], exact: true }).tap();
  else await page.keyboard.press(arrows[d]);
}
async function observe(page: Page) {
  return page.getByTestId('board').evaluate((el) => ({
    status: el.getAttribute('data-status'),
    x: Number(el.getAttribute('data-x')),
    y: Number(el.getAttribute('data-y')),
    wave: Number(el.getAttribute('data-wave')),
    hp: Number(el.getAttribute('data-hp')),
    interval: Number(el.getAttribute('data-step')),
    walls: Array.from(el.querySelectorAll('[data-wall]')).map((n) =>
      n.getAttribute('data-wall'),
    ),
    pickups: Array.from(el.querySelectorAll('[data-pickup]')).map((n) => ({
      x: Number(n.getAttribute('data-x')),
      y: Number(n.getAttribute('data-y')),
      kind: n.getAttribute('data-pickup'),
    })),
    enemies: Array.from(el.querySelectorAll('[data-enemy]')).map((n) => ({
      x: Number(n.getAttribute('data-x')),
      y: Number(n.getAttribute('data-y')),
      stunned: n.getAttribute('data-stunned') === 'true',
    })),
  }));
}
function route(s: Awaited<ReturnType<typeof observe>>): Direction {
  const q = [{ x: s.x, y: s.y, first: 'stop' as Direction }],
    seen = new Set([`${s.x},${s.y}`]);
  const danger = (x: number, y: number) =>
    s.enemies.some(
      (e) => !e.stunned && Math.abs(e.x - x) + Math.abs(e.y - y) < 2,
    );
  for (let i = 0; i < q.length; i++) {
    const p = q[i];
    if (
      i > 0 &&
      s.pickups.some((t) => t.x === p.x && t.y === p.y && t.kind !== 'acid')
    )
      return p.first;
    for (const [d, dx, dy] of [
      ['right', 1, 0],
      ['down', 0, 1],
      ['left', -1, 0],
      ['up', 0, -1],
    ] as const) {
      const x = p.x + dx,
        y = p.y + dy,
        key = `${x},${y}`;
      if (
        x < 1 ||
        y < 1 ||
        x > 15 ||
        y > 15 ||
        s.walls.includes(key) ||
        seen.has(key) ||
        danger(x, y)
      )
        continue;
      seen.add(key);
      q.push({ x, y, first: i === 0 ? d : p.first });
    }
  }
  // A blocked escape is resolved by the visible pulse/dash controls on the next loop.
  return 'right';
}
async function playToEnd(page: Page, touch: boolean, support: string) {
  for (let i = 0; i < 500; i++) {
    const s = await observe(page);
    if (s.status === 'won' || s.status === 'lost') return s;
    if (s.status === 'wave') {
      const choice = page.getByRole('button', { name: support, exact: true });
      if (touch) await choice.tap();
      else await choice.click();
      await expect(choice).toHaveAttribute('aria-pressed', 'true');
      await page.getByRole('button', { name: '次のステージへ' }).click();
      await page.clock.runFor(50);
      if (support === '補給を満タン')
        await expect(page.locator('#energy')).toHaveAttribute('value', '100');
      if (support === '時間を増やす')
        expect(
          Number.parseInt((await page.getByTestId('time').textContent())!, 10),
        ).toBeGreaterThan(s.wave === 0 ? 50 : 55);
      continue;
    }
    if (s.status === 'paused')
      throw new Error('Unexpected automatic pause during active play');
    const near = s.enemies.some(
      (e) => !e.stunned && Math.abs(e.x - s.x) + Math.abs(e.y - s.y) <= 5,
    );
    const pulse = page.getByRole('button', { name: /✳ パルス/ });
    if (near && (await pulse.isEnabled())) {
      if (touch) await pulse.tap();
      else await page.keyboard.press('j');
    }
    await command(page, route(s), touch);
    await page.clock.runFor(s.interval * 1000 + 20);
  }
  throw new Error(
    'Playable route did not terminate within 500 control actions',
  );
}
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-07T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-07T00:00:01Z'));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'プレイ開始' })).toBeVisible();
});
for (const [mode, label] of [
  ['low', '低め'],
  ['middle', '中間'],
  ['high', '高め'],
] as const) {
  test(`${mode}: controls → 3 stages → result → seeded retry`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const requests: string[] = [];
    page.on('request', (r) => {
      if (!r.url().startsWith('http://127.0.0.1:4187')) requests.push(r.url());
    });
    const touch = info.project.name.startsWith('mobile');
    await page.getByRole('button', { name: new RegExp(label + ' ×') }).click();
    await page
      .getByLabel('プレイスタイル', { exact: true })
      .selectOption('breaker');
    if (mode === 'middle')
      await page.screenshot({
        path: `docs/screenshots/${info.project.name}-ready.png`,
        fullPage: true,
      });
    await page.getByRole('button', { name: 'プレイ開始' }).click();
    await page.clock.runFor(100);
    await command(page, 'right', touch);
    await page.clock.runFor(500);
    expect((await observe(page)).x).toBeGreaterThan(1);
    await expect(page.getByTestId('score')).not.toHaveText('00000');
    await command(page, 'stop', touch);
    const p = await observe(page);
    await page.clock.runFor(250);
    expect((await observe(page)).x).toBe(p.x);
    await page.getByRole('button', { name: '一時停止', exact: true }).click();
    const time = await page.getByTestId('time').textContent();
    await page.clock.runFor(5000);
    await expect(page.getByTestId('time')).toHaveText(time!);
    await page.getByRole('button', { name: 'プレイを再開' }).click();
    if (mode === 'middle')
      await page.screenshot({
        path: `docs/screenshots/${info.project.name}-playing.png`,
        fullPage: false,
      });
    const result = await playToEnd(
      page,
      touch,
      mode === 'low'
        ? '守りを固める'
        : mode === 'middle'
          ? '補給を満タン'
          : '時間を増やす',
    );
    expect(result.status).toBe('won');
    await expect(page.getByText('踏破、おめでとう！')).toBeVisible();
    await page.screenshot({
      path: `docs/screenshots/${info.project.name}-${mode}-clear.png`,
      fullPage: true,
    });
    const score = await page.getByTestId('score').textContent();
    await expect(page.getByTestId(`best-${mode}`)).toHaveText(
      score!.replace(/^0+(?=\d)/, ''),
    );
    const seedBefore = await page
      .getByLabel('コース番号', { exact: true })
      .inputValue();
    await page.getByRole('button', { name: '同じコースで再挑戦' }).click();
    await expect(page.getByTestId('board')).toHaveAttribute('data-wave', '0');
    await expect(page.getByTestId('score')).toHaveText('00000');
    expect(
      await page.getByLabel('コース番号', { exact: true }).inputValue(),
    ).toBe(seedBefore);
    await page.reload();
    await expect(page.getByTestId(`best-${mode}`)).toHaveText(
      score!.replace(/^0+(?=\d)/, ''),
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
    expect(requests).toEqual([]);
  });
}
test('failure → retry, dash, pause on blur/hidden/offscreen, science and no overflow', async ({
  page,
}, info) => {
  const touch = info.project.name.startsWith('mobile');
  await page.getByRole('button', { name: /高め ×/ }).click();
  await page.getByRole('button', { name: 'プレイ開始' }).click();
  await command(page, 'right', touch);
  if (touch) await page.getByRole('button', { name: /↗ ダッシュ/ }).tap();
  else await page.keyboard.press('k');
  await page.clock.runFor(150);
  await expect(page.getByTestId('cooldown')).toContainText('回復まで');
  await command(page, 'stop', touch);
  await page.clock.runFor(60000);
  await expect(page.getByTestId('board')).toHaveAttribute(
    'data-status',
    'lost',
  );
  await expect(
    page.getByRole('button', { name: '同じコースで再挑戦' }),
  ).toBeVisible();
  await page.screenshot({
    path: `docs/screenshots/${info.project.name}-failure.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: '同じコースで再挑戦' }).click();
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.clock.runFor(100);
  await expect(page.getByTestId('board')).toHaveAttribute(
    'data-status',
    'paused',
  );
  await page.getByRole('button', { name: 'プレイを再開' }).click();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.runFor(100);
  await expect(page.getByTestId('board')).toHaveAttribute(
    'data-status',
    'paused',
  );
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.runFor(1000);
  await expect(page.getByTestId('board')).toHaveAttribute(
    'data-status',
    'paused',
  );
  await page.getByRole('button', { name: 'プレイを再開' }).click();
  if (touch) {
    // Active phone play now occupies the viewport. It must not be scrolled
    // away to reach reference material; first leave the session explicitly.
    const before = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 800);
    await page.clock.runFor(200);
    expect(await page.evaluate(() => window.scrollY)).toBe(before);
    await expect(page.getByTestId('board')).toHaveAttribute(
      'data-status',
      'playing',
    );
    await page.getByRole('button', { name: '一時停止', exact: true }).click();
    await page.getByRole('button', { name: 'このプレイをやめる' }).click();
    await page.getByText('出典とゲーム表現の違いを見る').click();
  } else {
    await page.getByText('出典とゲーム表現の違いを見る').click();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.clock.runFor(200);
    await expect(page.getByTestId('board')).toHaveAttribute(
      'data-status',
      'paused',
    );
  }
  await expect(page.getByText('出典で確認', { exact: true })).toBeVisible();
  await expect(page.getByText('教育用の簡略化', { exact: true })).toBeVisible();
  await expect(
    page.getByText('架空のゲーム係数', { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test('reduced motion, corrupt storage and all setup/navigation buttons', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() =>
    localStorage.setItem('sat-shubo-arcade:v1', 'not-json'),
  );
  await page.reload();
  await expect(page.getByTestId('best-low')).toHaveText('0');
  await page.getByRole('button', { name: 'プレイ開始' }).click();
  await page.keyboard.press('ArrowRight');
  await page.clock.runFor(400);
  expect(
    await page
      .locator('.player')
      .evaluate((e) => getComputedStyle(e).transitionDuration),
  ).toBe('0s');
  await page.keyboard.press('Escape');
  await page.clock.runFor(50);
  await expect(
    page.getByRole('button', { name: 'プレイを再開' }),
  ).toBeFocused();
  await page.getByRole('button', { name: 'このプレイをやめる' }).click();
  await page.getByRole('button', { name: 'プレイ開始' }).click();
  await page.clock.runFor(60000);
  await page.getByRole('button', { name: '別のコース・設定を選ぶ' }).click();
  await expect(page.getByTestId('board')).toHaveAttribute(
    'data-status',
    'ready',
  );
  await expect(page.getByLabel('コース番号', { exact: true })).toHaveValue(
    '260908',
  );
});
