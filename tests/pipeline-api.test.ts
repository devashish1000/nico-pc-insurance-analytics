import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: supabaseMocks.createClient,
}));

import handler, { isAllowedOrigin, parsePipelineAction } from '../api/pipeline-runs';

const runId = '11111111-1111-4111-8111-111111111111';
const recoveryRunId = '22222222-2222-4222-8222-222222222222';

const baseRun = {
  run_id: runId,
  status: 'success',
  trigger_type: 'manual',
  started_at: '2026-07-13T21:00:00.000Z',
  finished_at: '2026-07-13T21:00:00.250Z',
  duration_ms: 250,
  premium_rows: 600,
  loss_rows: 320,
  dq_run_id: '33333333-3333-4333-8333-333333333333',
  checks_passed: 6,
  checks_total: 6,
  mode: 'incremental',
  scenario: null,
  watermark_start: { premium: { sourceId: 'p1' } },
  watermark_end: { premium: { sourceId: 'p2' } },
  source_rows: 4,
  inserted_rows: 1,
  updated_rows: 1,
  unchanged_rows: 2,
  recalculated_rows: 0,
  rejected_rows: 0,
  freshness_lag_seconds: 12,
  recovered_from_run_id: null,
};

const stageRows = [{
  stage_order: 20,
  stage_name: 'validate_dedupe',
  status: 'success',
  started_at: '2026-07-13T21:00:00.010Z',
  finished_at: '2026-07-13T21:00:00.020Z',
  duration_ms: 10,
  input_rows: 4,
  inserted_rows: 0,
  updated_rows: 0,
  unchanged_rows: 0,
  recalculated_rows: 0,
  rejected_rows: 0,
  sanitized_error: null,
  error_code: 'SHOULD_NOT_LEAK',
}];

const quarantineRows = [{
  quarantine_id: '44444444-4444-4444-8444-444444444444',
  run_id: runId,
  source_name: 'premium',
  reason_code: 'MISSING_POLICY_NUMBER',
  severity: 'critical',
  disposition: 'pending',
  quarantined_at: '2026-07-13T21:00:00.020Z',
  resolved_at: null,
  recovered_by_run_id: null,
  payload: { policy_number: 'SHOULD_NOT_LEAK' },
  sql_error: 'SHOULD_NOT_LEAK',
}];

function mockResponse() {
  const state = { status: 200, headers: {} as Record<string, string>, body: undefined as unknown };
  const response = {
    setHeader(name: string, value: string) { state.headers[name] = value; return response; },
    status(code: number) { state.status = code; return response; },
    json(body: unknown) { state.body = body; return response; },
  } as unknown as VercelResponse;
  return { response, state };
}

function mockRequest(
  method = 'POST',
  body: unknown = { action: 'run' },
  origin = 'https://nico-pc-insurance-analytics.vercel.app',
  secFetchSite = 'same-origin',
) {
  return {
    method,
    body,
    headers: { origin, 'sec-fetch-site': secFetchSite },
  } as unknown as VercelRequest;
}

function queryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.limit = vi.fn(async () => result);
  builder.single = vi.fn(async () => result);
  return builder;
}

function configureEvidence(options: {
  run?: Record<string, unknown>;
  stages?: unknown[];
  quarantine?: unknown[];
  runError?: unknown;
  stageError?: unknown;
  quarantineError?: unknown;
} = {}) {
  const run = options.run ?? baseRun;
  supabaseMocks.from.mockImplementation((table: string) => {
    if (table === 'pipeline_runs') {
      return queryBuilder({ data: run, error: options.runError ?? null });
    }
    if (table === 'vw_pipeline_stage_runs') {
      return queryBuilder({ data: options.stages ?? stageRows, error: options.stageError ?? null });
    }
    if (table === 'vw_quarantine_evidence') {
      return queryBuilder({
        data: options.quarantine ?? quarantineRows,
        error: options.quarantineError ?? null,
      });
    }
    throw new Error(`Unexpected table ${table}`);
  });
}

async function invoke(request = mockRequest()) {
  const { response, state } = mockResponse();
  await handler(request, response);
  return state;
}

describe('strict pipeline action parsing', () => {
  it('accepts only the three documented body shapes', () => {
    expect(parsePipelineAction({ action: 'run' })).toEqual({
      ok: true, value: { action: 'run' },
    });
    expect(parsePipelineAction('{"action":"simulate-failure"}')).toEqual({
      ok: true, value: { action: 'simulate-failure' },
    });
    expect(parsePipelineAction({ action: 'recover', recoveryRunId })).toEqual({
      ok: true, value: { action: 'recover', recoveryRunId },
    });
  });

  it('rejects malformed JSON, unknown actions, extra fields, and invalid UUIDs', () => {
    expect(parsePipelineAction('{bad json').ok).toBe(false);
    expect(parsePipelineAction({ action: 'delete' }).ok).toBe(false);
    expect(parsePipelineAction({ action: 'run', extra: true }).ok).toBe(false);
    expect(parsePipelineAction({ action: 'recover' }).ok).toBe(false);
    expect(parsePipelineAction({ action: 'recover', recoveryRunId: 'not-a-uuid' }).ok).toBe(false);
    expect(parsePipelineAction([]).ok).toBe(false);
  });
});

describe('pipeline API boundary and execution', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PIPELINE_EXECUTION_ENABLED = 'true';
    process.env.SUPABASE_URL = 'https://project.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'server-only-secret';
    supabaseMocks.createClient.mockReturnValue({
      rpc: supabaseMocks.rpc,
      from: supabaseMocks.from,
    });
    supabaseMocks.rpc.mockResolvedValue({
      data: { run_id: runId, accepted: true },
      error: null,
    });
    configureEvidence();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('allows production, project previews, and local development origins', () => {
    expect(isAllowedOrigin('https://nico-pc-insurance-analytics.vercel.app')).toBe(true);
    expect(isAllowedOrigin('https://nico-pc-insurance-analytics-abc123-devashish1000s-projects.vercel.app')).toBe(true);
    expect(isAllowedOrigin('http://127.0.0.1:4178')).toBe(true);
    expect(isAllowedOrigin('https://example.com')).toBe(false);
    expect(isAllowedOrigin(undefined)).toBe(false);
  });

  it('rejects non-POST and cross-site requests before touching Supabase', async () => {
    const methodState = await invoke(mockRequest('GET'));
    expect(methodState.status).toBe(405);
    expect(methodState.headers.Allow).toBe('POST');

    const crossSiteState = await invoke(mockRequest('POST', { action: 'run' },
      'https://nico-pc-insurance-analytics.vercel.app', 'cross-site'));
    expect(crossSiteState.status).toBe(403);
    expect(supabaseMocks.createClient).not.toHaveBeenCalled();
  });

  it('fails closed when execution is not explicitly enabled', async () => {
    process.env.PIPELINE_EXECUTION_ENABLED = 'false';
    const state = await invoke();
    expect(state.status).toBe(503);
    expect(state.body).toEqual({ message: 'Interactive pipeline execution is disabled.' });
    expect(supabaseMocks.createClient).not.toHaveBeenCalled();
  });

  it('rejects invalid bodies before creating a privileged client', async () => {
    for (const body of ['{bad json', { action: 'run', extra: 'no' }, { action: 'recover', recoveryRunId: 'bad' }]) {
      const state = await invoke(mockRequest('POST', body));
      expect(state.status).toBe(400);
    }
    expect(supabaseMocks.createClient).not.toHaveBeenCalled();
  });

  it('fails closed when server-only credentials are absent', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const state = await invoke();
    expect(state.status).toBe(503);
    expect(state.body).toEqual({ message: 'The controlled pipeline service is not configured.' });
  });

  it('uses the legacy zero-argument RPC for a normal run and preserves response fields', async () => {
    configureEvidence({ quarantine: quarantineRows });
    const state = await invoke();
    expect(supabaseMocks.rpc).toHaveBeenCalledWith('run_demo_pipeline');
    expect(state.status).toBe(200);
    expect(state.body).toMatchObject({
      runId,
      status: 'success',
      trigger: 'manual',
      rowCounts: { factPremium: 600, factLoss: 320 },
      dq: { passed: 6, total: 6 },
      counts: { source: 4, inserted: 1, updated: 1, unchanged: 2, rejected: 0 },
    });
    const serialized = JSON.stringify(state.body);
    expect(serialized).not.toContain('SHOULD_NOT_LEAK');
    expect(serialized).not.toContain('payload');
    expect(serialized).not.toContain('error_code');
  });

  it('records a controlled failure through the action RPC and returns sanitized evidence', async () => {
    configureEvidence({
      run: { ...baseRun, status: 'failed', scenario: 'controlled-failure', rejected_rows: 1 },
    });
    const state = await invoke(mockRequest('POST', { action: 'simulate-failure' }));
    expect(supabaseMocks.rpc).toHaveBeenCalledWith('run_demo_pipeline_action', {
      p_action: 'simulate-failure',
      p_recovery_run_id: null,
    });
    expect(state.status).toBe(200);
    expect(state.body).toMatchObject({
      status: 'failed',
      scenario: 'controlled-failure',
      message: 'Controlled failure recorded; published facts and watermarks were unchanged.',
    });
  });

  it('passes only a validated UUID to the recovery action and returns recovery lineage', async () => {
    configureEvidence({
      run: { ...baseRun, scenario: 'recovery', recovered_from_run_id: recoveryRunId },
      quarantine: [{ ...quarantineRows[0], disposition: 'replayed', recovered_by_run_id: runId }],
    });
    const state = await invoke(mockRequest('POST', { action: 'recover', recoveryRunId }));
    expect(supabaseMocks.rpc).toHaveBeenCalledWith('run_demo_pipeline_action', {
      p_action: 'recover',
      p_recovery_run_id: recoveryRunId,
    });
    expect(state.status).toBe(200);
    expect(state.body).toMatchObject({ recoveredFromRunId: recoveryRunId });
  });

  it('returns accurate five-minute and fifteen-minute cooldown responses', async () => {
    supabaseMocks.rpc.mockResolvedValue({ data: { run_id: runId, accepted: false }, error: null });
    const normal = await invoke();
    expect(normal.status).toBe(429);
    expect(normal.headers['Retry-After']).toBe('300');
    expect(JSON.stringify(normal.body)).toContain('five-minute');

    const simulated = await invoke(mockRequest('POST', { action: 'simulate-failure' }));
    expect(simulated.status).toBe(429);
    expect(simulated.headers['Retry-After']).toBe('900');
    expect(JSON.stringify(simulated.body)).toContain('fifteen-minute');
  });

  it('returns conflict when a recovery has already been consumed', async () => {
    supabaseMocks.rpc.mockResolvedValue({ data: { run_id: runId, accepted: false }, error: null });
    const state = await invoke(mockRequest('POST', { action: 'recover', recoveryRunId }));
    expect(state.status).toBe(409);
    expect(state.headers['Retry-After']).toBeUndefined();
    expect(state.body).toMatchObject({ message: 'This recovery is no longer available.' });
  });

  it('returns a sanitized server error for an unexpected failed run', async () => {
    configureEvidence({ run: { ...baseRun, status: 'failed', scenario: null } });
    const state = await invoke();
    expect(state.status).toBe(500);
    expect(state.body).toMatchObject({
      message: 'Pipeline execution failed. Review the sanitized stage evidence.',
    });
  });

  it('sanitizes RPC, run-evidence, and linked-evidence failures', async () => {
    supabaseMocks.rpc.mockResolvedValueOnce({ data: null, error: { message: 'raw SQL detail' } });
    const rpcFailure = await invoke();
    expect(rpcFailure.status).toBe(502);
    expect(JSON.stringify(rpcFailure.body)).not.toContain('raw SQL detail');

    supabaseMocks.rpc.mockResolvedValue({ data: { run_id: runId, accepted: true }, error: null });
    configureEvidence({ runError: { message: 'private table detail' } });
    const runFailure = await invoke();
    expect(runFailure.status).toBe(502);
    expect(JSON.stringify(runFailure.body)).not.toContain('private table detail');

    configureEvidence({ stageError: { message: 'private stage detail' } });
    const stageFailure = await invoke();
    expect(stageFailure.status).toBe(502);
    expect(JSON.stringify(stageFailure.body)).not.toContain('private stage detail');

    configureEvidence({ quarantineError: { message: 'private quarantine payload detail' } });
    const quarantineFailure = await invoke();
    expect(quarantineFailure.status).toBe(502);
    expect(JSON.stringify(quarantineFailure.body)).not.toContain('private quarantine payload detail');
  });
});
