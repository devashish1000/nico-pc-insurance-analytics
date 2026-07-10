import React, { useEffect, useState } from 'react';
import { ShieldCheck, CheckCircle2, XCircle } from 'lucide-react';
import { supabase, DqRow } from '../lib/supabase';
import { Card, SectionTitle, Loading, ErrorNote, Badge, StatCard } from './ui';

const catTone: Record<string, 'green' | 'amber' | 'red' | 'slate' | 'blue'> = {
  reconciliation: 'blue', integrity: 'red', completeness: 'amber', validity: 'green',
};

export default function DataQuality() {
  const [rows, setRows] = useState<DqRow[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('vw_data_quality_latest').select('*');
      if (error) return setErr(error.message);
      setRows(data as DqRow[]);
    })();
  }, []);

  if (err) return <ErrorNote msg={err} />;
  if (!rows.length) return <Loading />;

  const passed = rows.filter((r) => r.status === 'pass').length;
  const critical = rows.filter((r) => r.severity === 'critical').length;

  return (
    <div>
      <SectionTitle
        title="Data Quality & Integrity"
        subtitle="Automated validation suite (PL/pgSQL stored procedure sp_run_data_quality) run after every source→published load — reconciliation, referential integrity, completeness, and validity."
        icon={<ShieldCheck size={20} />}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Checks Passing" value={`${passed}/${rows.length}`} accent={passed === rows.length ? 'text-emerald-600' : 'text-red-600'} />
        <StatCard label="Critical Checks" value={String(critical)} sub="reconciliation + integrity" />
        <StatCard label="Last Run" value={new Date(rows[0].checked_at).toLocaleDateString()} sub={new Date(rows[0].checked_at).toLocaleTimeString()} />
        <StatCard label="Suite Status" value={passed === rows.length ? 'GREEN' : 'ATTENTION'} accent={passed === rows.length ? 'text-emerald-600' : 'text-red-600'} />
      </div>

      <Card className="mt-4 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-2.5 font-semibold">Check</th>
              <th className="px-4 py-2.5 font-semibold">Category</th>
              <th className="px-4 py-2.5 font-semibold">Severity</th>
              <th className="px-4 py-2.5 text-right font-semibold">Expected</th>
              <th className="px-4 py-2.5 text-right font-semibold">Actual</th>
              <th className="px-4 py-2.5 text-center font-semibold">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r, i) => (
              <tr key={i} className="hover:bg-slate-50/60">
                <td className="px-4 py-2.5 font-medium text-slate-800">{r.check_name}</td>
                <td className="px-4 py-2.5"><Badge tone={catTone[r.category] ?? 'slate'}>{r.category}</Badge></td>
                <td className="px-4 py-2.5 text-slate-500">{r.severity}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">{r.expected_value}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">{r.actual_value}</td>
                <td className="px-4 py-2.5 text-center">
                  {r.status === 'pass' ? (
                    <CheckCircle2 className="mx-auto text-emerald-500" size={18} />
                  ) : (
                    <XCircle className="mx-auto text-red-500" size={18} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
