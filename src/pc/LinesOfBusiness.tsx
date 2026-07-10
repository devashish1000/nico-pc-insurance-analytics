import React, { useEffect, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { Layers } from 'lucide-react';
import { supabase, LobRow, AgentRow, StateRow } from '../lib/supabase';
import { usd, pct, num, lossRatioColor } from '../lib/format';
import { Card, SectionTitle, Loading, ErrorNote } from './ui';

export default function LinesOfBusiness() {
  const [lob, setLob] = useState<LobRow[]>([]);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [states, setStates] = useState<StateRow[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      const [l, a, s] = await Promise.all([
        supabase.from('vw_loss_ratio_by_lob').select('*'),
        supabase.from('vw_top_agents').select('*'),
        supabase.from('vw_state_premium').select('*'),
      ]);
      if (l.error || a.error || s.error) return setErr(l.error?.message || a.error?.message || s.error?.message || '');
      setLob(l.data as LobRow[]);
      setAgents(a.data as AgentRow[]);
      setStates(s.data as StateRow[]);
    })();
  }, []);

  if (err) return <ErrorNote msg={err} />;
  if (!lob.length) return <Loading />;

  return (
    <div>
      <SectionTitle
        title="Lines of Business"
        subtitle="Premium, loss, and loss-ratio breakdown by LOB — plus distribution by agent and state (dimensional drill-across)."
        icon={<Layers size={20} />}
      />

      <Card className="data-table-scroll">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-2.5 font-semibold">Line of Business</th>
              <th className="px-4 py-2.5 text-right font-semibold">Policies</th>
              <th className="px-4 py-2.5 text-right font-semibold">Written Premium</th>
              <th className="px-4 py-2.5 text-right font-semibold">Incurred Loss</th>
              <th className="px-4 py-2.5 text-right font-semibold">Loss Ratio</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lob.map((r) => (
              <tr key={r.lob_code} className="hover:bg-slate-50/60">
                <td className="px-4 py-2.5 font-medium text-slate-800">{r.lob_name}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">{num(r.policy_count)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">{usd(r.written_premium)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">{usd(r.incurred_loss)}</td>
                <td className="px-4 py-2.5 text-right">
                  <span className="rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums text-white"
                    style={{ backgroundColor: lossRatioColor(r.loss_ratio_pct) }}>
                    {pct(r.loss_ratio_pct)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <div className="mb-3 text-sm font-semibold text-slate-700">Written Premium by State</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={states} margin={{ left: 4, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
              <XAxis dataKey="state" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tickFormatter={(v) => usd(v)} tick={{ fontSize: 11, fill: '#94a3b8' }} width={54} />
              <Tooltip formatter={(v: number) => usd(v, false)} />
              <Bar dataKey="written_premium" name="Written Premium" radius={[3, 3, 0, 0]}>
                {states.map((_, i) => <Cell key={i} fill="#1f3a5f" />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-4">
          <div className="mb-3 text-sm font-semibold text-slate-700">Top Producers (by written premium)</div>
          <div className="space-y-1.5">
            {agents.slice(0, 8).map((a, i) => (
              <div key={i} className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-slate-50">
                <div>
                  <div className="font-medium text-slate-800">{a.agent_name}</div>
                  <div className="text-[11px] text-slate-400">{a.agency} · {a.region}</div>
                </div>
                <div className="text-right">
                  <div className="tabular-nums font-semibold text-slate-800">{usd(a.written_premium)}</div>
                  <div className="text-[11px] text-slate-400">{num(a.policy_count)} policies</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
