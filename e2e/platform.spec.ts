import { expect, test } from '@playwright/test';

test('persona choice persists in the URL and reorders the journey', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore as a Business Analyst' }).click();
  await expect(page).toHaveURL(/persona=business-analyst&view=requirements/);
  await expect(page.getByRole('heading', { name: 'Requirements & Acceptance Criteria' })).toBeVisible();
  if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Requirements & Tests' })).toBeVisible();
  const labels = await page.locator('.platform-nav .nav-item button').allTextContents();
  expect(labels).toEqual([
    'Requirements & Tests', 'Rating Engine', 'Portfolio Overview', 'Lines of Business',
    'Warehouse Architecture', 'Data Quality', 'Azure Stack Mapping', 'Pipeline Runs',
  ]);
});

test('acceptance suite executes against rating logic and warehouse views', async ({ page }) => {
  await page.goto('/?persona=business-analyst&view=requirements');
  await page.getByRole('button', { name: 'Run acceptance suite' }).click();
  await expect(page.locator('.suite-score')).toContainText('10/10 passing');
  await expect(page.locator('.test-status.pass')).toHaveCount(10);
});

test('guided tour navigates to the persona evidence', async ({ page }, testInfo) => {
  await page.goto('/?persona=data-engineer&view=warehouse');
  if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: 'Start tour' }).click();
  else await page.getByRole('button', { name: 'Replay tour' }).click();
  await expect(page.getByRole('heading', { name: 'Follow the warehouse' })).toBeVisible();
  await page.getByRole('button', { name: 'Show me' }).click();
  await expect(page).toHaveURL(/view=warehouse/);
});

test('mobile layout has no page-level horizontal overflow', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'mobile-only assertion');
  const destinations = [
    '/',
    '/?persona=data-engineer&view=warehouse',
    '/?persona=data-engineer&view=pipeline',
    '/?persona=data-engineer&view=dq',
    '/?persona=data-engineer&view=overview',
    '/?persona=data-engineer&view=lob',
    '/?persona=data-engineer&view=azure',
    '/?persona=business-analyst&view=rating',
    '/?persona=business-analyst&view=requirements',
  ];
  for (const destination of destinations) {
    await page.goto(destination);
    const sizes = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
    expect(sizes.scrollWidth, `overflow at ${destination}`).toBeLessThanOrEqual(sizes.clientWidth);
  }
  for (const view of ['lob', 'dq']) {
    await page.goto(`/?persona=data-engineer&view=${view}`);
    const table = page.locator('.data-table-scroll').first();
    await expect(table).toBeVisible();
    const overflow = await table.evaluate((element) => ({ scrollWidth: element.scrollWidth, clientWidth: element.clientWidth, overflowX: getComputedStyle(element).overflowX }));
    expect(overflow.scrollWidth).toBeGreaterThan(overflow.clientWidth);
    expect(overflow.overflowX).toBe('auto');
  }
  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible();
});
