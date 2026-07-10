import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';
import { LayoutDashboard, AlertTriangle } from 'lucide-react';
import { supabase, KpiSummary, LobRow, TrendRow } from '../lib/supabase';
import { usd, pct, num, lossRatioColor } from '../lib/format';
import { Card, SectionTitle, StatCard, Loading, ErrorNote, Badge } from './ui';

export default function Overview() {
  const [kpi, setKpi] = useState<KpiSummary | null>(null);
  const [lob, setLob] = useState<LobRow[]>([]);
  const [trend, setTrend] = useState<TrendRow[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      const [k, l, pt, lt] = await Promise.all([
        supabase.from('vw_kpi_summary').select('*').single(),
        supabase.from('vw_loss_ratio_by_lob').select('*'),
        supabase.from('vw_premium_trend_monthly').select('*'),
        supabase.from('vw_loss_trend_monthly').select('*'),
      ]);
      if (k.error || l.error || pt.error || lt.error) {
        setErr(k.error?.message || l.error?.message || pt.error?.message || lt.error?.message || 'Load error');
        return;
      }
      setKpi(k.data as KpiSummary);
      setLob(l.data as LobRow[]);
      // merge premium + loss trends by month
      const lossMap = new Map((lt.data as TrendRow[]).map((r) => [r.ym, r.incurred_loss]));
      setTrend((pt.data as TrendRow[]).map((r) => ({ ...r, incurred_loss: lossMap.get(r.ym) ?? 0 })));
    })();
  }, []);

  if (err) return <ErrorNote msg={err} />;
  if (!kpi) return <Loading />;

  const unprofitable = lob.filter((r) => r.loss_ratio_pct > 100);

  return (
    <div>
      <SectionTitle
        title="Portfolio Overview"
        subtitle="Executive view of the P&C book — premium, losses, and loss ratio, served from the Supabase star-schema warehouse."
        icon={<LayoutDashboard size={20} />}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Written Premium" value={usd(kpi.written_premium)} sub={`${num(kpi.policy_count)} policies`} />
        <StatCard label="Earned Premium" value={usd(kpi.earned_premium)} sub={`${usd(kpi.unearned_premium)} unearned`} />
        <StatCard label="Incurred Loss" value={usd(kpi.incurred_loss)} sub={`${num(kpi.claim_count)} claims`} />
        <StatCard
          label="Loss Ratio"
          value={pct(kpi.loss_ratio_pct)}
          sub={kpi.loss_ratio_pct > 100 ? 'above break-even' : 'profitable'}
          accent={kpi.loss_ratio_pct > 100 ? 'text-red-600' : 'text-emerald-600'}
        />
      </div>

      {unprofitable.length > 0 && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="mt-0.5 shrink-0 text-amber-600" size={18} />
          <div className="text-sm text-amber-800">
            <span className="font-semibold">Rate-adequacy alert:</span>{' '}
            {unprofitable.map((r) => r.lob_name).join(' and ')} {unprofitable.length > 1 ? 'are' : 'is'} running above a
            100% loss ratio ({unprofitable.map((r) => `${r.lob_name} ${pct(r.loss_ratio_pct)}`).join(', ')}). These lines
            need rate action or tighter underwriting.
          </div>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <div className="mb-3 text-sm font-semibold text-slate-700">Premium vs. Incurred Loss (monthly)</div>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={trend} margin={{ left: 4, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
              <XAxis dataKey="ym" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tickFormatter={(v) => usd(v)} tick={{ fontSize: 11, fill: '#94a3b8' }} width={54} />
              <Tooltip formatter={(v: number) => usd(v, false)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="written_premium" name="Written Premium" fill="#1f3a5f" radius={[3, 3, 0, 0]} />
              <Line dataKey="incurred_loss" name="Incurred Loss" stroke="#dc2626" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-4">
          <div className="mb-3 text-sm font-semibold text-slate-700">Loss Ratio by Line of Business</div>
          <div className="space-y-3">
            {lob.map((r) => (
              <div key={r.lob_code}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">{r.lob_name}</span>
                  <span className="tabular-nums" style={{ color: lossRatioColor(r.loss_ratio_pct) }}>
                    {pct(r.loss_ratio_pct)}
                  </span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, r.loss_ratio_pct)}%`,
                      backgroundColor: lossRatioColor(r.loss_ratio_pct),
                    }}
                  />
                </div>
                <div className="mt-0.5 text-[11px] text-slate-400">
                  {usd(r.written_premium)} premium · {usd(r.incurred_loss)} loss
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2 text-[11px] text-slate-400">
            <Badge tone="green">&lt;60% healthy</Badge>
            <Badge tone="amber">60–100% watch</Badge>
            <Badge tone="red">&gt;100% unprofitable</Badge>
          </div>
        </Card>
      </div>
    </div>
  );
}
