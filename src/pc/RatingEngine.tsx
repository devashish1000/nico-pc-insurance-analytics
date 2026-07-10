import React, { useMemo, useState } from 'react';
import { Calculator, ArrowRight } from 'lucide-react';
import {
  LOBS, TERRITORIES, TIERS, LIMIT_FACTORS, DEDUCTIBLES, ENDORSEMENTS, DISCOUNTS, rate, RatingInput, Lob,
} from '../lib/ratingModel';
import { usd } from '../lib/format';
import { Card, SectionTitle } from './ui';

const Select: React.FC<{ label: string; value: string; onChange: (v: string) => void; options: { code: string; name: string }[] }> = ({
  label, value, onChange, options,
}) => (
  <label className="block">
    <span className="mb-1 block text-xs font-semibold text-slate-500">{label}</span>
    <select
      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-slate-400 focus:outline-none"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}
    </select>
  </label>
);

const Chips: React.FC<{ label: string; options: { code: string; name: string; premium?: number; factor?: number }[]; selected: string[]; toggle: (c: string) => void }> = ({
  label, options, selected, toggle,
}) => (
  <div>
    <span className="mb-1 block text-xs font-semibold text-slate-500">{label}</span>
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = selected.includes(o.code);
        return (
          <button
            key={o.code}
            onClick={() => toggle(o.code)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              on ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
            }`}
          >
            {o.name}
            {o.premium != null && <span className="ml-1 opacity-70">+${o.premium}</span>}
            {o.factor != null && <span className="ml-1 opacity-70">×{o.factor}</span>}
          </button>
        );
      })}
    </div>
  </div>
);

export default function RatingEngine() {
  const [input, setInput] = useState<RatingInput>({
    lob: 'CAUTO' as Lob, territory: 'NE', tier: 'STD', limit: 'L2', deductible: 'D1000',
    endorsements: ['EQ'], discounts: ['MULTI'], priorClaims: 0,
  });
  const result = useMemo(() => rate(input), [input]);
  const set = (patch: Partial<RatingInput>) => setInput((s) => ({ ...s, ...patch }));
  const toggle = (key: 'endorsements' | 'discounts', code: string) =>
    setInput((s) => ({ ...s, [key]: s[key].includes(code) ? s[key].filter((c) => c !== code) : [...s[key], code] }));

  return (
    <div>
      <SectionTitle
        title="P&C Rating & Quote Engine"
        subtitle="Interactive premium calculation — base rate × territory × risk tier × limits, with deductible credits, endorsements, discounts and surcharges. Documented in the Requirements tab."
        icon={<Calculator size={20} />}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="p-5 lg:col-span-3">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select label="Line of Business" value={input.lob} onChange={(v) => set({ lob: v as Lob })} options={LOBS} />
            <Select label="Territory (state)" value={input.territory} onChange={(v) => set({ territory: v })} options={TERRITORIES} />
            <Select label="Risk Tier" value={input.tier} onChange={(v) => set({ tier: v })} options={TIERS} />
            <Select label="Liability Limit" value={input.limit} onChange={(v) => set({ limit: v })} options={LIMIT_FACTORS} />
            <Select label="Deductible" value={input.deductible} onChange={(v) => set({ deductible: v })} options={DEDUCTIBLES} />
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-500">Prior claims (3 yrs)</span>
              <input
                type="number" min={0} max={5}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-slate-400 focus:outline-none"
                value={input.priorClaims}
                onChange={(e) => set({ priorClaims: Math.max(0, Math.min(5, Number(e.target.value) || 0)) })}
              />
            </label>
          </div>
          <div className="mt-4 space-y-4">
            <Chips label="Endorsements" options={ENDORSEMENTS} selected={input.endorsements} toggle={(c) => toggle('endorsements', c)} />
            <Chips label="Discounts" options={DISCOUNTS} selected={input.discounts} toggle={(c) => toggle('discounts', c)} />
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Indicated Annual Premium</div>
          <div className="mt-1 text-4xl font-bold tabular-nums text-slate-900">{usd(result.annualPremium, false)}</div>
          <div className="text-sm text-slate-500">{usd(result.monthly, false)} / month</div>

          <div className="mt-4 border-t border-slate-100 pt-3">
            <div className="mb-2 text-xs font-semibold text-slate-500">Rating worksheet</div>
            <div className="space-y-1">
              {result.steps.map((s, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">
                    {s.label} <span className="text-slate-400">· {s.detail}</span>
                  </span>
                  <span className="tabular-nums font-medium text-slate-700">{usd(Math.round(s.running), false)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-sm font-bold">
                <span className="flex items-center gap-1 text-slate-700"><ArrowRight size={13} /> Final premium</span>
                <span className="tabular-nums text-slate-900">{usd(result.annualPremium, false)}</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
