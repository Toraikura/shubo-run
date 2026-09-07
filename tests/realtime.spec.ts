import { test, expect } from '@playwright/test';
test('real wall-clock game: start, move, lose, retry without clock mocking', async ({
  page,
}, info) => {
  await page.goto('/');
  await page.getByRole('button', { name: /高め ×/ }).click();
  await page.getByRole('button', { name: 'プレイ開始' }).click();
  if (info.project.name.startsWith('mobile'))
    await page.getByRole('button', { name: '右', exact: true }).tap();
  else await page.keyboard.press('ArrowRight');
  await expect
    .poll(
      async () =>
        Number(await page.getByTestId('board').getAttribute('data-x')),
      { timeout: 2000 },
    )
    .toBeGreaterThan(2);
  if (info.project.name.startsWith('mobile'))
    await page.getByRole('button', { name: '停止', exact: true }).tap();
  else await page.keyboard.press('x');
  await expect(page.getByTestId('time')).not.toHaveText('45');
  await expect(page.getByTestId('board')).toHaveAttribute(
    'data-status',
    'lost',
    { timeout: 60000 },
  );
  await page.getByRole('button', { name: '同じコースで再挑戦' }).click();
  await expect(page.getByTestId('board')).toHaveAttribute(
    'data-status',
    'playing',
  );
  await expect(page.getByTestId('board')).toHaveAttribute('data-hp', '3');
  await page.getByRole('button', { name: '一時停止', exact: true }).click();
  await expect(page.getByTestId('board')).toHaveAttribute(
    'data-status',
    'paused',
  );
});
