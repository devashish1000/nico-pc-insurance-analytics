import { expect, test } from '@playwright/test';

test('persona choice persists in the URL and reorders the journey', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore as a Business Analyst' }).click();
  await expect(page).toHaveURL(/persona=business-analyst&view=requirements/);
  await expect(page.getByRole('heading', { name: 'Requirements & Acceptance Criteria' })).toBeVisible();
  if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Requirements & Tests' })).toBeVisible();
});

test('acceptance suite executes against rating logic and warehouse views', async ({ page }) => {
  await page.goto('/?persona=business-analyst&view=requirements');
  await page.getByRole('button', { name: 'Run acceptance suite' }).click();
  await expect(page.locator('.suite-score')).toContainText('10/10 passing');
  await expect(page.locator('.test-status.pass')).toHaveCount(10);
});

test('guided tour navigates to the persona evidence', async ({ page }) => {
  await page.goto('/?persona=data-engineer&view=warehouse');
  await page.getByRole('button', { name: 'Replay tour' }).click();
  await expect(page.getByRole('heading', { name: 'Follow the warehouse' })).toBeVisible();
  await page.getByRole('button', { name: 'Show me' }).click();
  await expect(page).toHaveURL(/view=warehouse/);
});

test('mobile layout has no page-level horizontal overflow', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'mobile-only assertion');
  await page.goto('/');
  const sizes = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
  expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.clientWidth);
  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible();
});
