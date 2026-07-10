import { AlertCircle, CalendarClock, CheckCircle2, Clock3, Play, RefreshCw, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { supabase, type PipelineRun } from '../lib/supabase';
import { Badge, Card, ErrorNote, Loading, SectionTitle, StatCard } from './ui';

type PipelineResponse = {
  runId: string;
  status: string;
  trigger: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  rowCounts: { factPremium: number | null; factLoss: number | null };
  dq: { runId: string | null; passed: number | null; total: number | null };
  message?: string;
};

function formatDuration(duration: number | null) {
  if (duration == null) return '—';
  return duration < 1000 ? `${duration} ms` : `${(duration / 1000).toFixed(1)} sec`;
}

export default function PipelineRuns() {
  const [rows, setRows] = useState<PipelineRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    const { data, error: queryError } = await supabase.from('vw_pipeline_runs').select('*').limit(14);
    if (queryError) {
      setError(queryError.message.includes('schema cache') ? 'Pipeline history is awaiting the secure database migration.' : queryError.message);
    } else {
      setError('');
      setRows((data ?? []) as PipelineRun[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const runPipeline = async () => {
    setRunning(true);
    setNotice('');
    setError('');
    try {
      const response = await fetch('/api/pipeline-runs', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      const body = await response.json() as PipelineResponse;
      if (!response.ok) throw new Error(body.message || 'The controlled pipeline run did not complete.');
      setNotice(`Run ${body.runId.slice(0, 8)} completed: ${body.dq.passed}/${body.dq.total} checks passing.`);
      await load();
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'Pipeline request failed.');
    } finally {
      setRunning(false);
    }
  };

  const latest = rows[0];
  const successes = rows.filter((row) => row.status === 'success').length;

  return (
    <div>
      <SectionTitle
        title="Pipeline Runs"
        subtitle="A controlled source-to-published warehouse reload with advisory locking, data-quality execution, scheduled history, and operational evidence."
        icon={<Play size={20} />}
        action={<button className="button-primary" onClick={runPipeline} disabled={running}><Play size={16} /> {running ? 'Running pipeline…' : 'Run pipeline live'}</button>}
      />

      <div className="pipeline-callout">
        <div><span className="section-kicker">Real warehouse execution</span><h2>Reload the synthetic book, then prove it.</h2><p>The browser calls a same-origin Vercel Function. Privileged SQL remains server-side, while the public app receives only sanitized row counts and test results.</p></div>
        <div className="pipeline-sequence" aria-label="Pipeline execution sequence">
          {['Load dimensions', 'Load facts', 'Run quality', 'Publish evidence'].map((step, index) => <span key={step}><b>0{index + 1}</b>{step}</span>)}
        </div>
      </div>

      {notice && <div className="success-note"><CheckCircle2 size={18} /> {notice}</div>}
      {error && <ErrorNote msg={error} />}

      {loading ? <Loading label="Loading pipeline evidence…" /> : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 pipeline-stats">
            <StatCard label="Latest Status" value={latest?.status?.toUpperCase() ?? 'AWAITING'} accent={latest?.status === 'success' ? 'text-emerald-700' : 'text-amber-700'} />
            <StatCard label="Recent Success" value={`${successes}/${rows.length || 0}`} sub="latest 14 executions" />
            <StatCard label="Fact Rows" value={latest ? `${(latest.premium_rows ?? 0) + (latest.loss_rows ?? 0)}` : '—'} sub={latest ? `${latest.premium_rows} premium · ${latest.loss_rows} loss` : 'no run yet'} />
            <StatCard label="Quality Controls" value={latest ? `${latest.checks_passed}/${latest.checks_total}` : '—'} sub="latest run" />
          </div>

          <Card className="pipeline-table-card">
            <div className="table-heading"><div><span className="section-kicker">Operational evidence</span><h2>Last 14 pipeline runs</h2></div><button className="button-quiet" onClick={load}><RefreshCw size={15} /> Refresh</button></div>
            <div className="data-table-scroll">
              <table className="data-table">
                <thead><tr><th>Run</th><th>Trigger</th><th>Started</th><th>Duration</th><th>Fact rows</th><th>DQ</th><th>Status</th></tr></thead>
                <tbody>{rows.length ? rows.map((row) => (
                  <tr key={row.run_id}>
                    <td><code>{row.run_id.slice(0, 8)}</code></td>
                    <td><Badge tone={row.trigger_type === 'scheduled' ? 'blue' : 'slate'}>{row.trigger_type === 'scheduled' ? <><CalendarClock size={12} /> scheduled</> : <><Play size={12} /> manual</>}</Badge></td>
                    <td>{new Date(row.started_at).toLocaleString()}</td>
                    <td><Clock3 size={13} /> {formatDuration(row.duration_ms)}</td>
                    <td>{(row.premium_rows ?? 0) + (row.loss_rows ?? 0)}</td>
                    <td>{row.checks_passed}/{row.checks_total}</td>
                    <td><span className={`run-status ${row.status}`}>{row.status === 'success' ? <CheckCircle2 size={15} /> : row.status === 'failed' ? <XCircle size={15} /> : <AlertCircle size={15} />}{row.status}</span></td>
                  </tr>
                )) : <tr><td colSpan={7} className="empty-table">No pipeline run evidence is available yet.</td></tr>}</tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

