import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  getRecoveryTarget,
  primaryBenchmarkArtifact,
  qualityOutcome,
} from '../src/lib/operationalEvidence';
import type { QuarantineEvidence } from '../src/lib/supabase';

const pipelineSource = readFileSync(new URL('../src/pc/PipelineRuns.tsx', import.meta.url), 'utf8');
const stageSource = readFileSync(new URL('../src/pc/OperationalEvidence.tsx', import.meta.url), 'utf8');
const qualitySource = readFileSync(new URL('../src/pc/DataQuality.tsx', import.meta.url), 'utf8');

function quarantine(
  runId: string,
  disposition: QuarantineEvidence['disposition'],
  recoverable = false,
): QuarantineEvidence {
  return {
    quarantine_id: `${runId}-record`,
    run_id: runId,
    source_name: 'premium',
    reason_code: 'MISSING_POLICY_NUMBER',
    severity: 'critical',
    disposition,
    quarantined_at: '2026-07-13T12:00:00Z',
    resolved_at: null,
    recovered_by_run_id: null,
    recoverable,
  };
}

describe('hiring-manager operational evidence UI', () => {
  it('recovers the original pending quarantine owner and ignores resolved evidence', () => {
    expect(getRecoveryTarget([
      quarantine('resolved-run', 'replayed'),
      quarantine('unrelated-pending-run', 'pending'),
      quarantine('original-failure', 'pending', true),
      quarantine('later-evidence', 'discarded'),
    ])).toBe('original-failure');
  });

  it('never offers recovery for a pending row outside the controlled-failure contract', () => {
    expect(getRecoveryTarget([
      quarantine('scheduled-quarantine', 'pending'),
      quarantine('manual-non-demo-quarantine', 'pending'),
    ])).toBeNull();
  });

  it('uses explicit PASS and FAIL outcomes rather than color alone', () => {
    expect(qualityOutcome(6, 6)).toBe('PASS · 6 of 6');
    expect(qualityOutcome(5, 6)).toBe('FAIL · 5 of 6');
    expect(qualityOutcome(null, null)).toBe('NOT RECORDED');
    expect(qualitySource).toContain("isPass ? 'PASS' : 'FAIL'");
  });

  it('exposes the complete normal, failure, quarantine, and recovery interaction', () => {
    expect(pipelineSource).toContain("runAction('run')");
    expect(pipelineSource).toContain("runAction('simulate-failure')");
    expect(pipelineSource).toContain("runAction('recover')");
    expect(pipelineSource).toContain("action === 'recover' ? { action, recoveryRunId: recoveryTarget } : { action }");
    expect(pipelineSource).toContain("if (!response.ok) throw new Error(body.message");
    expect(pipelineSource).not.toContain('expectedControlledFailure');
    expect(pipelineSource).not.toContain('existingControlledFailure');
    expect(pipelineSource).toContain("new Event('nico:proof-refresh')");
    expect(pipelineSource).toContain('Showing {rows.length} of {totalRecorded} recorded runs');
    expect(pipelineSource).toContain('value={`${successes} of ${rows.length}`}');
    expect(pipelineSource).toContain("latest.scenario ?? latest.mode ?? 'legacy run'");
  });

  it('shows all stage metrics and sanitized failure context', () => {
    for (const field of ['input_rows', 'inserted_rows', 'updated_rows', 'unchanged_rows', 'recalculated_rows', 'rejected_rows', 'duration_ms', 'sanitized_error']) {
      expect(stageSource).toContain(field);
    }
    expect(stageSource).toContain('Payloads, credentials, source identifiers, and stack traces stay behind the service boundary.');
  });

  it('labels benchmark evidence as disposable synthetic CI—not production scale', () => {
    expect(primaryBenchmarkArtifact.totalRows).toBe(150_000);
    expect(primaryBenchmarkArtifact.status).toBe('configured');
    expect(primaryBenchmarkArtifact.p50Ms).toBeNull();
    expect(primaryBenchmarkArtifact.p95Ms).toBeNull();
    expect(primaryBenchmarkArtifact.disclaimer).toContain('Synthetic portfolio data');
    expect(primaryBenchmarkArtifact.disclaimer).toContain('not live NICO data');
    expect(stageSource).toContain("'CONFIGURED CONTRACT' : 'RECORDED ARTIFACT'");
    expect(stageSource).toContain('· SYNTHETIC');
    expect(stageSource).toContain('p50/p95 captured per run');
  });

  it('provides accessible busy, status, and retry states', () => {
    expect(pipelineSource).toContain('aria-busy');
    expect(pipelineSource).toContain('aria-live="polite"');
    expect(pipelineSource).toContain('aria-describedby="pipeline-action-status"');
    expect(pipelineSource).toContain('Recover pending controlled failure unavailable: no pending recovery');
    expect(pipelineSource).toContain('if (!response.ok) throw new Error(body.message');
    expect(pipelineSource).toContain('Retry evidence');
    expect(qualitySource).toContain('Refreshing checks…');
    expect(qualitySource).toContain('Retry');
    expect(qualitySource).not.toContain('Six source-to-published controls');
  });
});
