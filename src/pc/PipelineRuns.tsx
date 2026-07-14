import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  actionCopy,
  formatDuration,
  formatFreshness,
  getRecoveryTarget,
  primaryBenchmarkArtifact,
  qualityOutcome,
} from '../lib/operationalEvidence';
import {
  supabase,
  type PipelineAction,
  type PipelineActionResponse,
  type PipelineRun,
  type PipelineStageRun,
  type QuarantineEvidence,
} from '../lib/supabase';
import {
  BenchmarkEvidencePanel,
  QuarantineEvidencePanel,
  StageEvidence,
} from './OperationalEvidence';
import { Badge, Card, ErrorNote, Loading, SectionTitle, StatCard } from './ui';

type EvidenceErrors = Partial<Record<'runs' | 'stages' | 'quarantine', string>>;

function schemaMessage(message: string, label: string) {
  return message.includes('schema cache') ? `${label} is awaiting the secure database migration.` : message;
}

export default function PipelineRuns() {
  const [rows, setRows] = useState<PipelineRun[]>([]);
  const [stages, setStages] = useState<PipelineStageRun[]>([]);
  const [quarantine, setQuarantine] = useState<QuarantineEvidence[]>([]);
  const [runCount, setRunCount] = useState(0);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [runningAction, setRunningAction] = useState<PipelineAction | null>(null);
  const [evidenceErrors, setEvidenceErrors] = useState<EvidenceErrors>({});
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async (background = false) => {
    if (background) setRefreshing(true);
    const [runsResult, stagesResult, quarantineResult] = await Promise.all([
      supabase.from('vw_pipeline_runs').select('*', { count: 'exact' }).order('started_at', { ascending: false }).limit(14),
      supabase.from('vw_pipeline_stage_runs').select('*').order('run_id').order('stage_order'),
      supabase.from('vw_quarantine_evidence').select('*').order('quarantined_at', { ascending: false }).limit(20),
    ]);

    const nextErrors: EvidenceErrors = {};
    if (runsResult.error) {
      nextErrors.runs = schemaMessage(runsResult.error.message, 'Pipeline history');
    } else {
      const nextRows = (runsResult.data ?? []) as PipelineRun[];
      setRows(nextRows);
      setRunCount(runsResult.count ?? nextRows.length);
      setSelectedRunId((current) => current && nextRows.some((row) => row.run_id === current) ? current : nextRows[0]?.run_id ?? null);
    }

    if (stagesResult.error) nextErrors.stages = schemaMessage(stagesResult.error.message, 'Stage evidence');
    else setStages((stagesResult.data ?? []) as PipelineStageRun[]);

    if (quarantineResult.error) nextErrors.quarantine = schemaMessage(quarantineResult.error.message, 'Quarantine evidence');
    else setQuarantine((quarantineResult.data ?? []) as QuarantineEvidence[]);

    setEvidenceErrors(nextErrors);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const recoveryTarget = useMemo(() => getRecoveryTarget(quarantine), [quarantine]);
  const selectedRun = rows.find((row) => row.run_id === selectedRunId) ?? rows[0];
  const selectedStages = stages.filter((stage) => stage.run_id === selectedRun?.run_id);
  const latest = rows[0];
  const successes = rows.filter((row) => row.status === 'success').length;

  const runAction = async (action: PipelineAction) => {
    if (action === 'recover' && !recoveryTarget) {
      setActionError('There is no pending controlled-failure run to recover. Record a controlled failure first.');
      return;
    }

    setRunningAction(action);
    setNotice('');
    setActionError('');
    try {
      const response = await fetch('/api/pipeline-runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action === 'recover' ? { action, recoveryRunId: recoveryTarget } : { action }),
      });
      const body = await response.json() as PipelineActionResponse;
      if (!response.ok) throw new Error(body.message || `${actionCopy(action)} did not complete.`);

      const runLabel = body.runId ? ` ${body.runId.slice(0, 8)}` : '';
      const dqResult = body.dq ? ` ${qualityOutcome(body.dq.passed, body.dq.total)}.` : '';
      if (action === 'simulate-failure') {
        setNotice(`Controlled failure${runLabel} recorded with sanitized quarantine evidence. Recovery is now available.`);
      } else if (action === 'recover') {
        setNotice(`Recovery${runLabel} completed against original run ${recoveryTarget?.slice(0, 8)}.${dqResult}`);
      } else {
        setNotice(`Normal pipeline run${runLabel} completed.${dqResult}`);
      }

      await load(true);
      window.dispatchEvent(new Event('nico:proof-refresh'));
    } catch (runError) {
      setActionError(runError instanceof Error ? runError.message : `${actionCopy(action)} request failed.`);
    } finally {
      setRunningAction(null);
    }
  };

  const totalRecorded = runCount || rows.length;

  return (
    <div className="operational-evidence-page">
      <SectionTitle
        title="Pipeline Runs"
        subtitle="Operate a synthetic source-to-published warehouse, inspect stage metrics, and prove a controlled failure-to-recovery path without exposing privileged data."
        icon={<Play size={20} />}
        action={(
          <div className="pipeline-action-group" aria-label="Pipeline actions">
            <button className="button-primary" onClick={() => void runAction('run')} disabled={runningAction !== null} aria-busy={runningAction === 'run'} aria-describedby="pipeline-action-status">
              <Play size={16} /> {runningAction === 'run' ? 'Running…' : 'Run normal'}
            </button>
            <button className="button-quiet pipeline-failure-action" onClick={() => void runAction('simulate-failure')} disabled={runningAction !== null} aria-busy={runningAction === 'simulate-failure'} aria-describedby="pipeline-action-status">
              <ShieldAlert size={16} /> {runningAction === 'simulate-failure' ? 'Recording failure…' : 'Simulate failure'}
            </button>
            <button className="button-quiet pipeline-recovery-action" onClick={() => void runAction('recover')} disabled={runningAction !== null || !recoveryTarget} aria-busy={runningAction === 'recover'} aria-describedby="pipeline-action-status" aria-label={recoveryTarget ? 'Recover pending controlled failure' : 'Recover pending controlled failure unavailable: no pending recovery'}>
              <RotateCcw size={16} /> {runningAction === 'recover' ? 'Recovering…' : 'Recover pending'}
            </button>
          </div>
        )}
      />

      <div className="pipeline-callout operational-workflow-callout">
        <div><span className="section-kicker">Operational proof path</span><h2>Run normally—or prove failure handling end to end.</h2><p>A same-origin server function controls execution. The browser receives bounded run metrics, sanitized quarantine reasons, and one recoverable lineage target.</p></div>
        <div className="pipeline-sequence operational-workflow-sequence" aria-label="Controlled pipeline workflow">
          {['Normal load', 'Controlled failure', 'Sanitized quarantine', 'Single recovery', 'PASS / FAIL evidence'].map((step, index) => <span key={step}><b>0{index + 1}</b>{step}</span>)}
        </div>
      </div>

      <div id="pipeline-action-status" aria-live="polite" aria-atomic="true">
        {notice && <div className="success-note"><CheckCircle2 size={18} aria-hidden="true" /> {notice}</div>}
        {actionError && <ErrorNote msg={actionError} />}
      </div>
      {evidenceErrors.runs && <div className="operational-partial-error"><ErrorNote msg={evidenceErrors.runs} /><button className="button-quiet" onClick={() => void load(true)} disabled={refreshing}><RefreshCw size={15} /> Retry evidence</button></div>}

      {loading ? <Loading label="Loading operational evidence…" /> : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 pipeline-stats operational-summary-stats">
            <StatCard label="Latest Status" value={latest?.status?.toUpperCase() ?? 'AWAITING'} sub={latest ? (latest.scenario ?? latest.mode ?? 'legacy run') : 'no run recorded'} accent={latest?.status === 'success' ? 'text-emerald-700' : latest?.status === 'failed' ? 'text-red-700' : 'text-amber-700'} />
            <StatCard label="Successful Runs" value={`${successes} of ${rows.length}`} sub="bounded public history" />
            <StatCard label="Latest Load" value={latest ? (latest.source_rows ?? ((latest.premium_rows ?? 0) + (latest.loss_rows ?? 0))).toLocaleString() : '—'} sub={latest ? `${latest.inserted_rows ?? 0} inserted · ${latest.rejected_rows ?? 0} rejected` : 'no run yet'} />
            <StatCard label="Quality Outcome" value={latest ? qualityOutcome(latest.checks_passed, latest.checks_total) : 'NOT RECORDED'} sub={latest ? `freshness ${formatFreshness(latest.freshness_lag_seconds)}` : 'no run yet'} accent={latest?.checks_total && latest.checks_passed === latest.checks_total ? 'text-emerald-700' : 'text-red-700'} />
          </div>

          <Card className="pipeline-table-card operational-runs-card">
            <div className="table-heading operational-evidence-heading">
              <div><span className="section-kicker">Operational evidence</span><h2>Showing {rows.length} of {totalRecorded} recorded runs</h2><p className="operational-evidence-summary">Select a run to inspect its stage-level inputs, changes, rejects, duration, and failure context.</p></div>
              <button className="button-quiet" onClick={() => void load(true)} disabled={refreshing}><RefreshCw className={refreshing ? 'spin' : ''} size={15} /> {refreshing ? 'Refreshing…' : 'Refresh evidence'}</button>
            </div>
            <div className="data-table-scroll">
              <table className="data-table operational-runs-table">
                <thead><tr><th>Run</th><th>Trigger / mode</th><th>Started</th><th>Duration</th><th>Source</th><th>Changed</th><th>Rejected</th><th>DQ result</th><th>Freshness</th><th>Status</th></tr></thead>
                <tbody>{rows.length ? rows.map((row) => (
                  <tr key={row.run_id} className={row.run_id === selectedRun?.run_id ? 'is-selected' : undefined}>
                    <td><button className="operational-run-selector" onClick={() => setSelectedRunId(row.run_id)} aria-pressed={row.run_id === selectedRun?.run_id}><code>{row.run_id.slice(0, 8)}</code><span>Inspect</span></button></td>
                    <td><Badge tone={row.trigger_type === 'scheduled' ? 'blue' : 'slate'}>{row.trigger_type === 'scheduled' ? <CalendarClock size={12} /> : <Play size={12} />}{row.trigger_type} · {row.mode ?? 'legacy'}</Badge></td>
                    <td>{new Date(row.started_at).toLocaleString()}</td>
                    <td><Clock3 size={13} aria-hidden="true" /> {formatDuration(row.duration_ms)}</td>
                    <td>{(row.source_rows ?? 0).toLocaleString()}</td>
                    <td>{((row.inserted_rows ?? 0) + (row.updated_rows ?? 0) + (row.recalculated_rows ?? 0)).toLocaleString()}</td>
                    <td>{(row.rejected_rows ?? 0).toLocaleString()}</td>
                    <td><strong>{qualityOutcome(row.checks_passed, row.checks_total)}</strong></td>
                    <td>{formatFreshness(row.freshness_lag_seconds)}</td>
                    <td><span className={`run-status ${row.status}`}>{row.status === 'success' ? <CheckCircle2 size={15} /> : row.status === 'failed' ? <XCircle size={15} /> : <AlertCircle size={15} />}{row.status.toUpperCase()}</span></td>
                  </tr>
                )) : <tr><td colSpan={10} className="empty-table">No pipeline run evidence is available yet.</td></tr>}</tbody>
              </table>
            </div>
          </Card>

          <StageEvidence run={selectedRun} rows={selectedStages} error={evidenceErrors.stages} />
          <QuarantineEvidencePanel rows={quarantine} recoveryTarget={recoveryTarget} error={evidenceErrors.quarantine} />
          <BenchmarkEvidencePanel artifact={primaryBenchmarkArtifact} />
        </>
      )}
    </div>
  );
}
