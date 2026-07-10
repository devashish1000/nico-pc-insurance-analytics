import React, { useEffect, useState } from 'react';
import { Database, ArrowRight } from 'lucide-react';
import { supabase, WhObject } from '../lib/supabase';
import { num } from '../lib/format';
import { Card, SectionTitle, Loading, ErrorNote, Badge } from './ui';

const PIPELINE = [
  { step: 'Source extract', detail: 'staging.raw_premium_txn · raw_claim_txn', note: 'Flat source-system feeds' },
  { step: 'sp_load_dimensions()', detail: 'upsert conformed dimensions + SCD2 policy', note: 'Stored procedure' },
  { step: 'sp_load_facts()', detail: 'load fact_premium + fact_loss', note: 'Stored procedure' },
  { step: 'sp_run_data_quality()', detail: 'reconciliation + integrity checks', note: 'Stored procedure' },
  { step: 'Published views', detail: 'vw_kpi_summary · vw_loss_ratio_by_lob …', note: 'Presentation layer' },
];

export default function Warehouse() {
  const [objs, setObjs] = useState<WhObject[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('vw_warehouse_objects').select('*');
      if (error) return setErr(error.message);
      setObjs(data as WhObject[]);
    })();
  }, []);

  if (err) return <ErrorNote msg={err} />;
  if (!objs.length) return <Loading />;

  const byLayer = (layer: string) => objs.filter((o) => o.layer === layer);
  const layerTone: Record<string, 'slate' | 'blue' | 'green'> = { staging: 'slate', dimension: 'blue', fact: 'green' };

  return (
    <div>
      <SectionTitle
        title="Warehouse Architecture"
        subtitle="Kimball star schema on Supabase Postgres — source → staging → published, loaded end-to-end by PL/pgSQL stored procedures."
        icon={<Database size={20} />}
      />

      <Card className="p-5">
        <div className="mb-3 text-sm font-semibold text-slate-700">Source-to-published pipeline</div>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch">
          {PIPELINE.map((p, i) => (
            <React.Fragment key={i}>
              <div className="flex-1 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="font-mono text-xs font-semibold text-slate-800">{p.step}</div>
                <div className="mt-1 text-[11px] text-slate-500">{p.detail}</div>
                <div className="mt-2"><Badge tone="blue">{p.note}</Badge></div>
              </div>
              {i < PIPELINE.length - 1 && (
                <div className="hidden items-center lg:flex"><ArrowRight className="text-slate-300" size={18} /></div>
              )}
            </React.Fragment>
          ))}
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {(['staging', 'dimension', 'fact'] as const).map((layer) => (
          <Card key={layer} className="p-4">
            <div className="mb-2 flex items-center gap-2">
              <Badge tone={layerTone[layer]}>{layer.toUpperCase()}</Badge>
              <span className="text-xs text-slate-400">{byLayer(layer).length} objects</span>
            </div>
            <div className="space-y-1.5">
              {byLayer(layer).map((o) => (
                <div key={o.object_name} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
                  <span className="font-mono text-xs text-slate-700">{o.object_name}</span>
                  <span className="tabular-nums text-xs text-slate-500">{num(o.row_count)} rows</span>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-4 p-5">
        <div className="mb-3 text-sm font-semibold text-slate-700">Star schema (grain: one row per premium / loss transaction)</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {['dim_date', 'dim_policy (SCD2)', 'dim_lob', 'dim_insured', 'dim_agent', 'dim_transaction_type'].map((d) => (
            <div key={d} className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-center text-xs font-medium text-blue-800">
              {d}
            </div>
          ))}
        </div>
        <div className="my-2 text-center text-slate-300">↓ surrogate keys ↓</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm font-semibold text-emerald-800">
            fact_premium
            <div className="mt-0.5 text-[11px] font-normal text-emerald-600">written / earned / unearned premium</div>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm font-semibold text-emerald-800">
            fact_loss
            <div className="mt-0.5 text-[11px] font-normal text-emerald-600">paid / reserve / incurred loss</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
