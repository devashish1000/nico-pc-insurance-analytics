import { expect, test, type Page, type TestInfo } from '@playwright/test';

const deliveryTabs = [
  { id: 'traceability', label: 'Traceability' },
  { id: 'workflow', label: 'As-Is / To-Be' },
  { id: 'raci', label: 'RACI' },
  { id: 'governance', label: 'Governance' },
  { id: 'backlog', label: 'Backlog' },
  { id: 'uat', label: 'UAT Readiness' },
] as const;

const businessAnalystNavigation = [
  'BA Delivery Hub',
  'Requirements & Tests',
  'Rating Engine',
  'Portfolio Overview',
  'Lines of Business',
  'Warehouse Architecture',
  'Data Quality',
  'Azure Stack Mapping',
  'Pipeline Runs',
];

const dataQualityRows = [
  'Policy premium reconciliation',
  'Incurred loss validity',
  'Policy key integrity',
  'Claim key integrity',
  'Policy completeness',
  'Claim completeness',
].map((check_name, index) => ({
  check_name,
  category: index === 0 ? 'reconciliation' : index === 1 ? 'validity' : 'integrity',
  severity: 'critical',
  status: 'pass',
  expected_value: 'pass',
  actual_value: 'pass',
  checked_at: '2026-07-13T18:00:00.000Z',
}));

const lossRatioRows = [
  { lob_code: 'HOME', lob_name: 'Homeowners', written_premium: 100, incurred_loss: 110, loss_ratio_pct: 110 },
  { lob_code: 'PAUTO', lob_name: 'Personal Auto', written_premium: 100, incurred_loss: 120, loss_ratio_pct: 120 },
  { lob_code: 'CAUTO', lob_name: 'Commercial Auto', written_premium: 100, incurred_loss: 50, loss_ratio_pct: 50 },
];

const warehouseObjects = [
  { layer: 'staging', object_name: 'raw_premium_txn', row_count: 720 },
  { layer: 'dimension', object_name: 'dim_policy', row_count: 240 },
  { layer: 'fact', object_name: 'fact_premium', row_count: 720 },
];

const kpiSummary = {
  written_premium: 1_000_000,
  earned_premium: 800_000,
  unearned_premium: 200_000,
  incurred_loss: 650_000,
  paid_loss: 500_000,
  open_reserves: 150_000,
  policy_count: 240,
  claim_count: 48,
  loss_ratio_pct: 65,
};

type EvidenceRouteState = {
  failDataQuality?: boolean;
  delayMs?: number;
  pipelineRuns?: Record<string, unknown>[];
  pipelineStages?: Record<string, unknown>[];
  quarantine?: Record<string, unknown>[];
};

const successfulRun = (runId = '11111111-1111-4111-8111-111111111111') => ({
  run_id: runId,
  trigger_type: 'manual',
  started_at: '2026-07-13T18:00:00.000Z',
  finished_at: '2026-07-13T18:00:01.000Z',
  status: 'success',
  duration_ms: 1000,
  premium_rows: 720,
  loss_rows: 360,
  dq_run_id: 'dq-success',
  checks_passed: 6,
  checks_total: 6,
  error_message: null,
  mode: 'incremental',
  scenario: null,
  watermark_start: {},
  watermark_end: {},
  source_rows: 1080,
  inserted_rows: 24,
  updated_rows: 6,
  unchanged_rows: 1050,
  recalculated_rows: 0,
  rejected_rows: 0,
  freshness_lag_seconds: 8,
  recovered_from_run_id: null,
});

const successfulStage = (runId = '11111111-1111-4111-8111-111111111111') => ({
  run_id: runId,
  stage_order: 1,
  stage_name: 'publish warehouse',
  status: 'success',
  started_at: '2026-07-13T18:00:00.000Z',
  finished_at: '2026-07-13T18:00:01.000Z',
  duration_ms: 1000,
  input_rows: 1080,
  inserted_rows: 24,
  updated_rows: 6,
  unchanged_rows: 1050,
  recalculated_rows: 0,
  rejected_rows: 0,
  error_code: null,
  sanitized_error: null,
});

function isCompact(testInfo: TestInfo) {
  return testInfo.project.name.startsWith('mobile');
}

async function installEvidenceRoutes(page: Page, state: EvidenceRouteState = {}) {
  state.pipelineRuns ??= [successfulRun()];
  state.pipelineStages ??= [successfulStage()];
  state.quarantine ??= [];

  await page.route('**/rest/v1/**', async (route) => {
    if (state.delayMs) await new Promise((resolve) => setTimeout(resolve, state.delayMs));

    const resource = new URL(route.request().url()).pathname.split('/').pop();
    if (resource === 'vw_data_quality_latest' && state.failDataQuality) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        json: { code: 'EVIDENCE_UNAVAILABLE', details: null, hint: null, message: 'Evidence temporarily unavailable' },
      });
      return;
    }

    const resources: Record<string, Record<string, unknown>[]> = {
      vw_data_quality_latest: dataQualityRows,
      vw_loss_ratio_by_lob: lossRatioRows,
      vw_warehouse_objects: warehouseObjects,
      vw_kpi_summary: [kpiSummary],
      vw_premium_trend_monthly: [{ ym: '2026-06', written_premium: 100_000 }],
      vw_loss_trend_monthly: [{ ym: '2026-06', incurred_loss: 65_000 }],
      vw_top_agents: [{ agent_name: 'Synthetic Agent', agency: 'Synthetic Agency', region: 'Midwest', written_premium: 100_000, policy_count: 24 }],
      vw_state_premium: [{ state: 'NE', written_premium: 100_000, policy_count: 24 }],
      vw_pipeline_runs: state.pipelineRuns ?? [],
      vw_pipeline_stage_runs: state.pipelineStages ?? [],
      vw_quarantine_evidence: state.quarantine ?? [],
    };
    const rows = resource ? resources[resource] ?? [] : [];
    const wantsSingleObject = route.request().headers().accept?.includes('application/vnd.pgrst.object+json');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'content-range': rows.length ? `0-${rows.length - 1}/${rows.length}` : '*/0' },
      json: wantsSingleObject ? rows[0] ?? {} : rows,
    });
  });
}

async function waitForView(page: Page) {
  await page.waitForFunction(() => {
    const content = document.querySelector('.platform-content');
    return Boolean(content && !content.querySelector('.view-loading') && !content.querySelector('.loading-state'));
  });
}

test('uses the exact NICO role labels and defaults the BA journey to the Delivery Hub', async ({ page }, testInfo) => {
  await installEvidenceRoutes(page);
  await page.goto('/');

  await expect(page.getByText('Data Engineer R14634 · IT Business Analyst', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Explore Data Engineer R14634', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Explore IT Business Analyst', exact: true }).click();

  await expect(page).toHaveURL(/persona=business-analyst&view=delivery&tab=traceability/);
  await expect(page.getByRole('heading', { name: 'IT Business Analyst Delivery Hub' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Traceability' })).toHaveAttribute('aria-selected', 'true');

  if (isCompact(testInfo)) await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await expect(page.getByLabel('Hiring perspective', { exact: true })).toHaveValue('business-analyst');
  await expect(page.getByLabel('Hiring perspective', { exact: true }).locator('option:checked')).toHaveText('IT Business Analyst');
  expect(await page.locator('.platform-nav .nav-item button').allTextContents()).toEqual(businessAnalystNavigation);
});

test('all six Delivery Hub artifacts are keyboard-operable, URL-shareable, and reload-safe', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'URL and tab behavior is viewport-independent.');
  await installEvidenceRoutes(page);
  await page.goto('/?persona=business-analyst&view=delivery&tab=traceability');

  const firstTab = page.getByRole('tab', { name: 'Traceability' });
  await firstTab.focus();
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: 'UAT Readiness' })).toBeFocused();
  await expect(page).toHaveURL(/tab=uat/);
  await page.keyboard.press('Home');
  await expect(firstTab).toBeFocused();
  await expect(page).toHaveURL(/tab=traceability/);

  for (const tab of deliveryTabs) {
    await page.getByRole('tab', { name: tab.label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`persona=business-analyst&view=delivery&tab=${tab.id}`));
    await expect(page.getByRole('tab', { name: tab.label, exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator(`#delivery-panel-${tab.id}`)).toBeVisible();
  }

  await page.reload();
  await expect(page.getByRole('tab', { name: 'UAT Readiness' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#delivery-panel-uat')).toContainText('No NICO stakeholder validation');
});

test('requirement discovery keeps the ten-test runner independent and exposes story detail', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Requirements behavior is viewport-independent.');
  await installEvidenceRoutes(page);
  await page.goto('/?persona=business-analyst&view=requirements');
  await waitForView(page);

  const acceptanceRows = page.locator('.traceability-table tbody tr');
  await expect(acceptanceRows).toHaveCount(10);
  await expect(page.locator('.suite-score')).toContainText('0/10 passing');

  await page.getByLabel('Priority').selectOption('Should');
  await expect(page.locator('.requirement-detail-card')).toHaveCount(1);
  await expect(page.locator('.requirement-detail-card')).toContainText('US-03');
  await page.getByRole('button', { name: 'Reset filters' }).click();

  await page.getByLabel('Role').selectOption('Portfolio Analyst');
  await expect(page.locator('.requirement-detail-card')).toHaveCount(1);
  await expect(page.locator('.requirement-detail-card')).toContainText('US-04');
  await page.getByRole('button', { name: 'Reset filters' }).click();

  await page.getByLabel('Search requirements').fill('no matching portfolio evidence');
  await expect(page.getByRole('heading', { name: 'No requirement stories match' })).toBeVisible();
  await expect(acceptanceRows).toHaveCount(10);
  await expect(page.getByText('The ten-test acceptance suite remains available above.')).toBeVisible();
  await page.getByRole('button', { name: 'Reset filters' }).last().click();

  await page.getByLabel('Business or data rule').fill('surcharge');
  await expect(page.locator('.requirement-detail-card')).toHaveCount(1);
  await expect(page.locator('.requirement-detail-card')).toContainText('US-03');
  await page.getByRole('button', { name: 'Reset filters' }).click();

  await page.getByLabel('Test ID or expected behavior').fill('AT-07');
  const story = page.locator('.requirement-detail-card').filter({ hasText: 'US-04' });
  await expect(story).toHaveCount(1);
  await story.locator('summary').click();
  await expect(story).toHaveAttribute('open', '');
  await expect(story).toContainText('Loss ratio equals incurred loss divided by written premium');
  await expect(story).toContainText('vw_loss_ratio_by_lob');

  await story.getByRole('button', { name: 'Run story suite' }).click();
  await expect(page.locator('.suite-score')).toContainText('2/10 passing');
  await expect(page.locator('.test-status.pass')).toHaveCount(2);
  await expect(page.locator('.test-status.pending')).toHaveCount(8);
  await expect(acceptanceRows).toHaveCount(10);

  await page.getByRole('button', { name: 'Collapse all shown' }).click();
  await expect(story).not.toHaveAttribute('open', '');
  await page.getByRole('button', { name: 'Expand all shown' }).click();
  await expect(story).toHaveAttribute('open', '');
});

test('controlled failure is quarantined once and recovers with lineage through mocked routes', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Operational behavior is viewport-independent.');
  const state: EvidenceRouteState = {
    pipelineRuns: [successfulRun()],
    pipelineStages: [successfulStage()],
    quarantine: [],
  };
  await installEvidenceRoutes(page, state);

  const failedRunId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const recoveryRunId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const actions: unknown[] = [];
  await page.route('**/api/pipeline-runs', async (route) => {
    const body = route.request().postDataJSON() as { action: string; recoveryRunId?: string };
    actions.push(body);
    if (body.action === 'simulate-failure') {
      state.pipelineRuns = [{
        ...successfulRun(failedRunId),
        status: 'failed',
        scenario: 'controlled-failure',
        checks_passed: 0,
        checks_total: 6,
        rejected_rows: 1,
        error_message: 'CONTROLLED_INVALID_PREMIUM',
      }, successfulRun()];
      state.pipelineStages = [{
        ...successfulStage(failedRunId),
        status: 'failed',
        rejected_rows: 1,
        error_code: 'CONTROLLED_INVALID_PREMIUM',
        sanitized_error: 'Controlled invalid premium record quarantined.',
      }, successfulStage()];
      state.quarantine = [{
        quarantine_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        run_id: failedRunId,
        source_name: 'premium',
        reason_code: 'CONTROLLED_INVALID_PREMIUM',
        severity: 'critical',
        disposition: 'pending',
        quarantined_at: '2026-07-13T18:05:00.000Z',
        resolved_at: null,
        recovered_by_run_id: null,
        recoverable: true,
      }];
      await route.fulfill({ status: 200, contentType: 'application/json', json: { runId: failedRunId, status: 'failed', scenario: 'controlled-failure' } });
      return;
    }

    if (body.action === 'recover') {
      state.pipelineRuns = [{
        ...successfulRun(recoveryRunId),
        scenario: 'recovery',
        recovered_from_run_id: failedRunId,
      }, ...(state.pipelineRuns ?? [])];
      state.pipelineStages = [successfulStage(recoveryRunId), ...(state.pipelineStages ?? [])];
      state.quarantine = (state.quarantine ?? []).map((row) => ({
        ...row,
        disposition: 'replayed',
        resolved_at: '2026-07-13T18:06:00.000Z',
        recovered_by_run_id: recoveryRunId,
        recoverable: false,
      }));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        json: { runId: recoveryRunId, status: 'success', scenario: 'recovery', recoveredFromRunId: failedRunId, dq: { runId: 'dq-recovery', passed: 6, total: 6 } },
      });
      return;
    }

    await route.fulfill({ status: 400, contentType: 'application/json', json: { message: 'Unexpected test action.' } });
  });

  await page.goto('/?persona=data-engineer&view=pipeline');
  await expect(page.getByRole('heading', { name: 'Showing 1 of 1 recorded runs' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Recover pending controlled failure unavailable/ })).toBeDisabled();

  await page.getByRole('button', { name: 'Simulate failure' }).click();
  await expect(page.getByText(/Controlled failure aaaaaaaa recorded with sanitized quarantine evidence/)).toBeVisible();
  await expect(page.locator('.operational-quarantine-table')).toContainText('CONTROLLED_INVALID_PREMIUM');
  await expect(page.locator('.operational-quarantine-table')).toContainText('PENDING');
  await expect(page.getByText('1 recovery target', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Recover pending controlled failure' }).click();
  await expect(page.getByText(/Recovery bbbbbbbb completed against original run aaaaaaaa\. PASS · 6 of 6\./)).toBeVisible();
  await expect(page.locator('.operational-quarantine-table')).toContainText('REPLAYED');
  await expect(page.locator('.operational-quarantine-table')).toContainText('bbbbbbbb');
  await expect(page.getByText('No pending recovery', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Recover pending controlled failure unavailable/ })).toBeDisabled();
  expect(actions).toEqual([
    { action: 'simulate-failure' },
    { action: 'recover', recoveryRunId: failedRunId },
  ]);
});

test('proof strip moves through loading, success, degraded, and successful retry states', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Proof state behavior is viewport-independent.');
  const state: EvidenceRouteState = { delayMs: 300 };
  await installEvidenceRoutes(page, state);
  await page.goto('/');

  const proof = page.getByRole('region', { name: 'Verified portfolio evidence' });
  await expect(proof).toHaveAttribute('aria-busy', 'true');
  await expect(proof.getByRole('button', { name: 'Verifying…' })).toBeDisabled();
  await expect(proof.locator('article').filter({ hasText: 'Latest data quality' })).toContainText('6/6');
  await expect(proof.locator('article').filter({ hasText: 'Acceptance verification' })).toContainText('10/10');
  await expect(proof.locator('article').filter({ hasText: 'Successful recorded runs' })).toContainText('1 of 1');
  await expect(proof).toHaveAttribute('aria-busy', 'false');

  state.delayMs = 0;
  state.failDataQuality = true;
  await proof.getByRole('button', { name: 'Verify again' }).click();
  await expect(proof.locator('article').filter({ hasText: 'Latest data quality' })).toContainText('Unavailable');
  await expect(proof.locator('article').filter({ hasText: 'Acceptance verification' })).toContainText('8/10');
  await expect(proof.locator('article').filter({ hasText: 'Latest verification' })).toContainText('Some evidence is degraded');

  state.failDataQuality = false;
  await proof.getByRole('button', { name: 'Verify again' }).click();
  await expect(proof.locator('article').filter({ hasText: 'Latest data quality' })).toContainText('6/6');
  await expect(proof.locator('article').filter({ hasText: 'Acceptance verification' })).toContainText('10/10');
  await expect(proof.locator('article').filter({ hasText: 'Latest verification' })).toContainText('Live checks completed');

  const failedRunId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const recoveryRunId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  state.pipelineRuns = [
    { ...successfulRun(recoveryRunId), scenario: 'recovery', recovered_from_run_id: failedRunId },
    { ...successfulRun(failedRunId), status: 'failed', scenario: 'controlled-failure' },
  ];
  state.quarantine = [{
    run_id: failedRunId,
    disposition: 'replayed',
    recovered_by_run_id: recoveryRunId,
  }];
  await proof.getByRole('button', { name: 'Verify again' }).click();
  await expect(proof.locator('article').filter({ hasText: 'Successful recorded runs' })).toContainText('1 of 2');
  await expect(proof.locator('article').filter({ hasText: 'Successful recorded runs' })).toContainText('1 controlled failure recovered; history retained');
  await expect(proof.locator('article').filter({ hasText: 'Latest verification' })).toContainText('Live checks healthy; recovery verified');
});

test('guided tour and compact navigation trap focus, close on Escape, and restore focus', async ({ page }, testInfo) => {
  await installEvidenceRoutes(page);
  await page.goto('/?persona=data-engineer&view=warehouse');
  await waitForView(page);

  if (isCompact(testInfo)) {
    const menuTrigger = page.getByRole('button', { name: 'Open navigation' });
    await menuTrigger.click();
    const navigationDialog = page.getByRole('dialog', { name: 'Platform navigation' });
    await expect(navigationDialog).toBeVisible();
    await expect(page.getByLabel('Hiring perspective', { exact: true })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(navigationDialog.getByRole('button', { name: 'Replay tour' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Hiring perspective', { exact: true })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(navigationDialog).toBeHidden();
    await expect(menuTrigger).toBeFocused();
  }

  const tourTrigger = isCompact(testInfo)
    ? page.getByRole('button', { name: 'Start tour' })
    : page.getByRole('button', { name: 'Replay tour' });
  await tourTrigger.click();
  const tour = page.getByRole('dialog', { name: 'Follow the warehouse' });
  await expect(tour).toBeVisible();
  await expect(tour.getByRole('button', { name: 'Close guided tour' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(tour.getByRole('button', { name: 'Show me' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(tour.getByRole('button', { name: 'Close guided tour' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(tour).toBeHidden();
  await expect(tourTrigger).toBeFocused();
});

test('every core view avoids page-level overflow at desktop, laptop, 390px, and 320px', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await installEvidenceRoutes(page);
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
    ...deliveryTabs.map((tab) => `/?persona=business-analyst&view=delivery&tab=${tab.id}`),
  ];

  for (const destination of destinations) {
    await page.goto(destination);
    await waitForView(page);
    await page.evaluate(() => document.fonts.ready);
    const sizes = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(sizes.scrollWidth, `${testInfo.project.name} overflow at ${destination}`).toBeLessThanOrEqual(sizes.clientWidth);
  }

  if (isCompact(testInfo)) {
    for (const view of ['lob', 'dq']) {
      await page.goto(`/?persona=data-engineer&view=${view}`);
      await waitForView(page);
      const table = page.locator('.data-table-scroll').first();
      await expect(table).toBeVisible();
      const overflow = await table.evaluate((element) => ({
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        overflowX: getComputedStyle(element).overflowX,
      }));
      expect(overflow.scrollWidth).toBeGreaterThan(overflow.clientWidth);
      expect(overflow.overflowX).toBe('auto');
    }
    await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible();
  }
});
