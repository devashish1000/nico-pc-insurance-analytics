import { describe, expect, it } from 'vitest';
import {
  assessPipelineHistory,
  type PipelineProofRow,
  type QuarantineProofRow,
} from '../src/lib/proof';

const run = (
  runId: string,
  overrides: Partial<PipelineProofRow> = {},
): PipelineProofRow => ({
  run_id: runId,
  status: 'success',
  scenario: null,
  recovered_from_run_id: null,
  started_at: '2026-07-14T00:00:00.000Z',
  finished_at: '2026-07-14T00:00:01.000Z',
  ...overrides,
});

describe('pipeline proof history', () => {
  it('keeps an all-success bounded history healthy', () => {
    const metric = assessPipelineHistory([run('run-1'), run('run-2')], []);

    expect(metric).toMatchObject({
      value: '2 of 2',
      detail: 'Latest bounded public history',
      state: 'success',
      recoveryVerified: false,
    });
  });

  it('keeps the honest denominator while recognizing a fully replayed recovery', () => {
    const failedRunId = 'failed-run';
    const recoveryRunId = 'recovery-run';
    const quarantine: QuarantineProofRow[] = [{
      run_id: failedRunId,
      disposition: 'replayed',
      recovered_by_run_id: recoveryRunId,
    }];
    const metric = assessPipelineHistory([
      run(recoveryRunId, { scenario: 'recovery', recovered_from_run_id: failedRunId }),
      run(failedRunId, { status: 'failed', scenario: 'controlled-failure' }),
    ], quarantine);

    expect(metric).toMatchObject({
      value: '1 of 2',
      detail: '1 controlled failure recovered; history retained',
      state: 'success',
      recoveryVerified: true,
    });
  });

  it('does not treat a linked run as recovered without replayed quarantine evidence', () => {
    const metric = assessPipelineHistory([
      run('recovery-run', { scenario: 'recovery', recovered_from_run_id: 'failed-run' }),
      run('failed-run', { status: 'failed', scenario: 'controlled-failure' }),
    ], []);

    expect(metric).toMatchObject({
      value: '1 of 2',
      detail: '1 run needs attention',
      state: 'attention',
      recoveryVerified: false,
    });
  });

  it('keeps unrelated failures in attention state', () => {
    const metric = assessPipelineHistory([
      run('run-1'),
      run('failed-run', { status: 'failed', scenario: null }),
    ], []);

    expect(metric).toMatchObject({
      value: '1 of 2',
      detail: '1 run needs attention',
      state: 'attention',
    });
  });
});
