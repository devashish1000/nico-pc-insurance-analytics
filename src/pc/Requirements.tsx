import React from 'react';
import { ClipboardList, CheckSquare } from 'lucide-react';
import { Card, SectionTitle, Badge } from './ui';

type Story = {
  id: string;
  role: string;
  want: string;
  soThat: string;
  priority: 'Must' | 'Should' | 'Could';
  criteria: { given: string; when: string; then: string }[];
  tests: string[];
};

const STORIES: Story[] = [
  {
    id: 'US-01', role: 'Underwriter', priority: 'Must',
    want: 'rate a policy from base rate, territory, tier and limits',
    soThat: 'I can quote an accurate, filed-rate premium',
    criteria: [
      { given: 'a Commercial Auto risk in Nebraska, Standard tier, $250K/$500K limit', when: 'I request a quote', then: 'the engine applies base rate × territory × tier × limit factors and returns an annual premium' },
    ],
    tests: ['Base × 1.0 territory × 1.0 tier × 1.18 limit reconciles to the worksheet total', 'Changing territory to Colorado (×1.18) increases premium proportionally'],
  },
  {
    id: 'US-02', role: 'Agent', priority: 'Must',
    want: 'apply deductible credits and multi-policy discounts',
    soThat: 'I can present competitive options to the insured',
    criteria: [
      { given: 'a quote with a $2,500 deductible and multi-policy discount', when: 'both are selected', then: 'the engine applies an 11% deductible credit and a ×0.90 discount multiplicatively' },
    ],
    tests: ['Deductible credit is applied before discounts', 'Removing the discount restores premium to the pre-discount value'],
  },
  {
    id: 'US-03', role: 'Underwriter', priority: 'Should',
    want: 'surcharge risks with prior claims',
    soThat: 'pricing reflects loss experience',
    criteria: [
      { given: 'a risk with 3 prior claims', when: 'the quote is calculated', then: 'a +12%/claim surcharge is applied, capped at +60%' },
    ],
    tests: ['4+ claims never exceed the +60% cap', 'Zero prior claims applies no surcharge'],
  },
  {
    id: 'US-04', role: 'Portfolio Analyst', priority: 'Must',
    want: 'see loss ratio by line of business from the warehouse',
    soThat: 'I can flag lines needing rate action',
    criteria: [
      { given: 'the published warehouse views', when: 'I open the Overview', then: 'lines above a 100% loss ratio are flagged with a rate-adequacy alert' },
    ],
    tests: ['Loss ratio = incurred loss ÷ written premium per LOB', 'Personal Auto and Homeowners surface in the alert when >100%'],
  },
  {
    id: 'US-05', role: 'Data Steward', priority: 'Must',
    want: 'automated data-quality checks after each load',
    soThat: 'I can trust the published numbers',
    criteria: [
      { given: 'a completed source→published load', when: 'sp_run_data_quality() runs', then: 'reconciliation, integrity, completeness and validity checks are recorded with pass/fail' },
    ],
    tests: ['Source row count equals published fact count', 'Incurred loss always equals paid + reserve'],
  },
];

const prTone = { Must: 'red', Should: 'amber', Could: 'slate' } as const;

export default function Requirements() {
  return (
    <div>
      <SectionTitle
        title="Requirements & Acceptance Criteria"
        subtitle="Business-analyst artifacts behind this build — INVEST user stories with Given/When/Then acceptance criteria, priority, and traceable test cases."
        icon={<ClipboardList size={20} />}
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-4"><div className="text-xs font-semibold uppercase text-slate-400">User stories</div><div className="mt-1 text-2xl font-bold text-slate-900">{STORIES.length}</div></Card>
        <Card className="p-4"><div className="text-xs font-semibold uppercase text-slate-400">Acceptance criteria</div><div className="mt-1 text-2xl font-bold text-slate-900">{STORIES.reduce((n, s) => n + s.criteria.length, 0)}</div></Card>
        <Card className="p-4"><div className="text-xs font-semibold uppercase text-slate-400">Traceable test cases</div><div className="mt-1 text-2xl font-bold text-slate-900">{STORIES.reduce((n, s) => n + s.tests.length, 0)}</div></Card>
      </div>

      <div className="space-y-3">
        {STORIES.map((s) => (
          <Card key={s.id} className="p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold text-slate-400">{s.id}</span>
              <Badge tone={prTone[s.priority]}>{s.priority}</Badge>
              <span className="text-sm text-slate-800">
                As a <span className="font-semibold">{s.role}</span>, I want to <span className="font-semibold">{s.want}</span>, so that {s.soThat}.
              </span>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="rounded-lg bg-slate-50 p-3">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Acceptance criteria (Given/When/Then)</div>
                {s.criteria.map((c, i) => (
                  <p key={i} className="text-xs leading-relaxed text-slate-600">
                    <span className="font-semibold text-slate-700">Given</span> {c.given},{' '}
                    <span className="font-semibold text-slate-700">when</span> {c.when},{' '}
                    <span className="font-semibold text-slate-700">then</span> {c.then}.
                  </p>
                ))}
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Test cases (traceability)</div>
                <ul className="space-y-1">
                  {s.tests.map((t, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600">
                      <CheckSquare size={13} className="mt-0.5 shrink-0 text-emerald-500" /> {t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
