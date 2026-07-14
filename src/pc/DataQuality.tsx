import { CheckCircle2, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { type DqRow, supabase } from '../lib/supabase';
import { Badge, Card, ErrorNote, Loading, SectionTitle, StatCard } from './ui';

const catTone: Record<string, 'green' | 'amber' | 'red' | 'slate' | 'blue'> = {
  reconciliation: 'blue', integrity: 'red', completeness: 'amber', validity: 'green',
};

export default function DataQuality() {
  const [rows, setRows] = useState<DqRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (background = false) => {
    if (background) setRefreshing(true);
    const { data, error: queryError } = await supabase.from('vw_data_quality_latest').select('*');
    if (queryError) {
      setError(queryError.message.includes('schema cache') ? 'Data-quality evidence is awaiting the secure database migration.' : queryError.message);
    } else {
      setRows((data ?? []) as DqRow[]);
      setError('');
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void load();
    const refresh = () => { void load(true); };
    window.addEventListener('nico:proof-refresh', refresh);
    return () => window.removeEventListener('nico:proof-refresh', refresh);
  }, [load]);

  const passed = rows.filter((row) => row.status === 'pass').length;
  const failed = rows.length - passed;
  const critical = rows.filter((row) => row.severity === 'critical').length;
  const suitePassed = rows.length > 0 && passed === rows.length;
  const latestCheckedAt = rows[0]?.checked_at ? new Date(rows[0].checked_at) : null;

  return (
    <div className="data-quality-evidence-page">
      <SectionTitle
        title="Data Quality & Integrity"
        subtitle="Recorded source-to-published controls cover reconciliation, referential integrity, completeness, SCD2 validity, and financial arithmetic after each pipeline run."
        icon={<ShieldCheck size={20} />}
        action={<button className="button-quiet" onClick={() => void load(true)} disabled={refreshing}><RefreshCw className={refreshing ? 'spin' : ''} size={15} /> {refreshing ? 'Refreshing checks…' : 'Refresh checks'}</button>}
      />

      {error && <div className="data-quality-retry"><ErrorNote msg={error} /><button className="button-quiet" onClick={() => void load(true)} disabled={refreshing}><RefreshCw size={15} /> Retry</button></div>}

      {loading ? <Loading label="Loading data-quality evidence…" /> : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 data-quality-summary">
            <StatCard label="Checks Passing" value={`${passed} of ${rows.length}`} sub={failed ? `${failed} failed` : 'all recorded checks'} accent={suitePassed ? 'text-emerald-600' : 'text-red-600'} />
            <StatCard label="Critical Checks" value={String(critical)} sub="reconciliation + integrity" />
            <StatCard label="Last Recorded" value={latestCheckedAt ? latestCheckedAt.toLocaleDateString() : '—'} sub={latestCheckedAt ? latestCheckedAt.toLocaleTimeString() : 'no suite recorded'} />
            <StatCard label="Suite Outcome" value={rows.length ? (suitePassed ? 'PASS' : 'FAIL') : 'NOT RECORDED'} sub="explicit evidence status" accent={suitePassed ? 'text-emerald-600' : 'text-red-600'} />
          </div>

          <Card className="mt-4 data-quality-table-card">
            <div className="table-heading data-quality-heading">
              <div><span className="section-kicker">Latest recorded suite</span><h2>{passed} of {rows.length} controls passing</h2><p className="operational-evidence-summary">Expected and actual values remain visible so PASS or FAIL can be reviewed instead of inferred from color.</p></div>
              <Badge tone={suitePassed ? 'green' : rows.length ? 'red' : 'slate'}>{rows.length ? (suitePassed ? 'PASS' : 'FAIL') : 'NOT RECORDED'}</Badge>
            </div>
            <div className="data-table-scroll">
              <table className="data-table data-quality-table">
                <thead><tr><th>Check</th><th>Category</th><th>Severity</th><th>Expected</th><th>Actual</th><th>Result</th></tr></thead>
                <tbody>{rows.length ? rows.map((row) => {
                  const isPass = row.status === 'pass';
                  return (
                    <tr key={`${row.check_name}-${row.checked_at}`}>
                      <td><strong>{row.check_name}</strong></td>
                      <td><Badge tone={catTone[row.category] ?? 'slate'}>{row.category}</Badge></td>
                      <td>{row.severity}</td>
                      <td className="tabular-nums">{row.expected_value}</td>
                      <td className="tabular-nums">{row.actual_value}</td>
                      <td><span className={`data-quality-result ${isPass ? 'pass' : 'fail'}`}>{isPass ? <CheckCircle2 size={17} aria-hidden="true" /> : <XCircle size={17} aria-hidden="true" />}<strong>{isPass ? 'PASS' : 'FAIL'}</strong></span></td>
                    </tr>
                  );
                }) : <tr><td colSpan={6} className="empty-table">No data-quality suite has been recorded yet.</td></tr>}</tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
