import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  DatabaseZap,
  FileJson2,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import type {
  BenchmarkArtifact,
  PipelineRun,
  PipelineStageRun,
  QuarantineEvidence,
} from '../lib/supabase';
import { formatDuration, formatFreshness, getRunFailureReason } from '../lib/operationalEvidence';
import { Badge, Card } from './ui';

function statusIcon(status: PipelineStageRun['status']) {
  if (status === 'success') return <CheckCircle2 size={15} aria-hidden="true" />;
  if (status === 'failed') return <XCircle size={15} aria-hidden="true" />;
  return <Clock3 size={15} aria-hidden="true" />;
}

export function StageEvidence({
  run,
  rows,
  error,
}: {
  run: PipelineRun | undefined;
  rows: PipelineStageRun[];
  error?: string;
}) {
  const failureReason = getRunFailureReason(run);
  const stageFailure = rows.find((row) => row.status === 'failed');

  return (
    <Card className="operational-stage-evidence">
      <div className="table-heading operational-evidence-heading">
        <div>
          <span className="section-kicker">Stage observability</span>
          <h2>{run ? `Run ${run.run_id.slice(0, 8)}` : 'Select a recorded run'}</h2>
          <p className="operational-evidence-summary">
            {run ? `${run.mode ?? 'legacy'} mode · freshness lag ${formatFreshness(run.freshness_lag_seconds)}` : 'Choose a run to inspect its source-to-published stages.'}
          </p>
        </div>
        {run && <Badge tone={run.status === 'success' ? 'green' : run.status === 'failed' ? 'red' : 'amber'}>{run.status.toUpperCase()}</Badge>}
      </div>

      {(failureReason || stageFailure?.sanitized_error || stageFailure?.error_code) && (
        <div className="operational-failure-reason" role="status">
          <AlertTriangle size={17} aria-hidden="true" />
          <div><strong>Sanitized failure reason</strong><p>{stageFailure?.sanitized_error || failureReason || stageFailure?.error_code}</p></div>
        </div>
      )}
      {error && <p className="operational-inline-error" role="alert">Stage evidence unavailable: {error}</p>}

      <div className="data-table-scroll">
        <table className="data-table operational-stage-table">
          <thead><tr><th>Stage</th><th>Status</th><th>Duration</th><th>Input</th><th>Inserted</th><th>Updated</th><th>Unchanged</th><th>Recalculated</th><th>Rejected</th></tr></thead>
          <tbody>
            {rows.length ? rows.map((row) => (
              <tr key={`${row.run_id}-${row.stage_order}`}>
                <td><strong>{row.stage_order}. {row.stage_name}</strong></td>
                <td><span className={`run-status ${row.status}`}>{statusIcon(row.status)}{row.status.toUpperCase()}</span></td>
                <td>{formatDuration(row.duration_ms)}</td>
                <td>{row.input_rows.toLocaleString()}</td>
                <td>{row.inserted_rows.toLocaleString()}</td>
                <td>{row.updated_rows.toLocaleString()}</td>
                <td>{row.unchanged_rows.toLocaleString()}</td>
                <td>{row.recalculated_rows.toLocaleString()}</td>
                <td>{row.rejected_rows.toLocaleString()}</td>
              </tr>
            )) : <tr><td colSpan={9} className="empty-table">{run ? 'No stage evidence was recorded for this run.' : 'No run selected.'}</td></tr>}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function QuarantineEvidencePanel({
  rows,
  recoveryTarget,
  error,
}: {
  rows: QuarantineEvidence[];
  recoveryTarget: string | null;
  error?: string;
}) {
  return (
    <Card className="operational-quarantine-evidence">
      <div className="table-heading operational-evidence-heading">
        <div>
          <span className="section-kicker">Sanitized quarantine</span>
          <h2>Failure and recovery evidence</h2>
          <p className="operational-evidence-summary">Payloads, credentials, source identifiers, and stack traces stay behind the service boundary.</p>
        </div>
        <Badge tone={recoveryTarget ? 'amber' : 'green'}>{recoveryTarget ? '1 recovery target' : 'No pending recovery'}</Badge>
      </div>
      {recoveryTarget && <p className="operational-recovery-target"><ShieldAlert size={16} aria-hidden="true" /> Original failed run <code>{recoveryTarget.slice(0, 8)}</code> remains the single recovery target.</p>}
      {error && <p className="operational-inline-error" role="alert">Quarantine evidence unavailable: {error}</p>}
      <div className="data-table-scroll">
        <table className="data-table operational-quarantine-table">
          <thead><tr><th>Run</th><th>Source</th><th>Reason</th><th>Severity</th><th>Disposition</th><th>Recorded</th><th>Recovered by</th></tr></thead>
          <tbody>{rows.length ? rows.map((row) => (
            <tr key={row.quarantine_id}>
              <td><code>{row.run_id.slice(0, 8)}</code></td>
              <td>{row.source_name}</td>
              <td><code>{row.reason_code}</code></td>
              <td><Badge tone={row.severity === 'critical' ? 'red' : 'amber'}>{row.severity}</Badge></td>
              <td><strong>{row.disposition.toUpperCase()}</strong></td>
              <td>{new Date(row.quarantined_at).toLocaleString()}</td>
              <td>{row.recovered_by_run_id ? <code>{row.recovered_by_run_id.slice(0, 8)}</code> : '—'}</td>
            </tr>
          )) : <tr><td colSpan={7} className="empty-table">No sanitized quarantine records are available.</td></tr>}</tbody>
        </table>
      </div>
    </Card>
  );
}

export function BenchmarkEvidencePanel({ artifact }: { artifact: BenchmarkArtifact }) {
  return (
    <Card className="operational-benchmark-evidence">
      <div className="operational-benchmark-heading">
        <div className="operational-benchmark-icon"><DatabaseZap size={20} aria-hidden="true" /></div>
        <div><span className="section-kicker">Disposable CI evidence</span><h2>Primary benchmark artifact contract</h2></div>
        <Badge tone="blue">{artifact.status === 'configured' ? 'CONFIGURED CONTRACT' : 'RECORDED ARTIFACT'} · SYNTHETIC</Badge>
      </div>
      <div className="operational-benchmark-grid">
        <div><span>Configured input</span><strong>{artifact.totalRows.toLocaleString()} rows</strong><small>{artifact.premiumRows.toLocaleString()} premium · {artifact.claimRows.toLocaleString()} claim</small></div>
        <div><span>Artifact schema</span><strong>v{artifact.schemaVersion}</strong><small>{artifact.mode} benchmark mode</small></div>
        <div><span>Query latency</span><strong>{artifact.p50Ms == null ? 'Recorded in CI JSON' : `p50 ${artifact.p50Ms} ms`}</strong><small>{artifact.p95Ms == null ? 'p50/p95 captured per run' : `p95 ${artifact.p95Ms} ms`}</small></div>
        <div><span>Execution plan</span><strong><FileJson2 size={16} aria-hidden="true" /> EXPLAIN ANALYZE</strong><small>PostgreSQL version, buffers, WAL, and stage timings</small></div>
      </div>
      <p className="operational-benchmark-disclaimer"><AlertTriangle size={16} aria-hidden="true" /><span><strong>{artifact.label}.</strong> {artifact.disclaimer} {artifact.provenance}.</span></p>
    </Card>
  );
}
