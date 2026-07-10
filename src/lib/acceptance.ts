import { rate, type RatingInput } from './ratingModel';
import { supabase } from './supabase';

export type AcceptanceStatus = 'pending' | 'running' | 'pass' | 'fail';

export type AcceptanceResult = {
  id: string;
  storyId: string;
  label: string;
  status: AcceptanceStatus;
  expected: string;
  actual: string;
  durationMs: number;
  ratingInput?: RatingInput;
};

export type AcceptanceCase = Omit<AcceptanceResult, 'status' | 'actual' | 'durationMs'> & {
  execute: () => Promise<{ pass: boolean; actual: string }>;
};

const ratingInput = (patch: Partial<RatingInput> = {}): RatingInput => ({
  lob: 'CAUTO', territory: 'NE', tier: 'STD', limit: 'L2', deductible: 'D500',
  endorsements: [], discounts: [], priorClaims: 0, ...patch,
});

const premium = (input: RatingInput) => rate(input).annualPremium;

export const ACCEPTANCE_CASES: AcceptanceCase[] = [
  {
    id: 'AT-01', storyId: 'US-01', label: 'Base factors reconcile', expected: '$6,136',
    ratingInput: ratingInput(),
    execute: async () => {
      const actual = premium(ratingInput());
      return { pass: actual === 6136, actual: `$${actual.toLocaleString()}` };
    },
  },
  {
    id: 'AT-02', storyId: 'US-01', label: 'Colorado territory is proportional', expected: '$7,240',
    ratingInput: ratingInput({ territory: 'CO' }),
    execute: async () => {
      const actual = premium(ratingInput({ territory: 'CO' }));
      return { pass: actual === 7240, actual: `$${actual.toLocaleString()}` };
    },
  },
  {
    id: 'AT-03', storyId: 'US-02', label: 'Deductible then discount', expected: '$4,915',
    ratingInput: ratingInput({ deductible: 'D2500', discounts: ['MULTI'] }),
    execute: async () => {
      const actual = premium(ratingInput({ deductible: 'D2500', discounts: ['MULTI'] }));
      return { pass: actual === 4915, actual: `$${actual.toLocaleString()}` };
    },
  },
  {
    id: 'AT-04', storyId: 'US-02', label: 'Removing discount restores premium', expected: '$5,461',
    ratingInput: ratingInput({ deductible: 'D2500' }),
    execute: async () => {
      const actual = premium(ratingInput({ deductible: 'D2500' }));
      return { pass: actual === 5461, actual: `$${actual.toLocaleString()}` };
    },
  },
  {
    id: 'AT-05', storyId: 'US-03', label: 'Prior-claim surcharge steps', expected: '0% / 48%',
    execute: async () => {
      const base = premium(ratingInput());
      const zero = premium(ratingInput({ priorClaims: 0 }));
      const four = premium(ratingInput({ priorClaims: 4 }));
      return { pass: zero === base && four === Math.round(base * 1.48), actual: `0% / ${Math.round((four / base - 1) * 100)}%` };
    },
  },
  {
    id: 'AT-06', storyId: 'US-03', label: 'Prior-claim cap', expected: '60% maximum',
    execute: async () => {
      const base = premium(ratingInput());
      const five = premium(ratingInput({ priorClaims: 5 }));
      return { pass: five === Math.round(base * 1.6), actual: `${Math.round((five / base - 1) * 100)}%` };
    },
  },
  {
    id: 'AT-07', storyId: 'US-04', label: 'Warehouse loss-ratio formula', expected: 'Every LOB reconciles',
    execute: async () => {
      const { data, error } = await supabase.from('vw_loss_ratio_by_lob').select('*');
      if (error) return { pass: false, actual: error.message };
      const bad = (data ?? []).filter((row) => Math.abs(Number(row.loss_ratio_pct) - Math.round(1000 * Number(row.incurred_loss) / Number(row.written_premium)) / 10) > 0.1);
      return { pass: bad.length === 0, actual: `${(data ?? []).length - bad.length}/${(data ?? []).length} reconcile` };
    },
  },
  {
    id: 'AT-08', storyId: 'US-04', label: 'Rate-adequacy alert population', expected: 'Homeowners + Personal Auto',
    execute: async () => {
      const { data, error } = await supabase.from('vw_loss_ratio_by_lob').select('lob_name,loss_ratio_pct');
      if (error) return { pass: false, actual: error.message };
      const names = (data ?? []).filter((row) => Number(row.loss_ratio_pct) > 100).map((row) => row.lob_name).sort();
      return { pass: names.join('|') === ['Homeowners', 'Personal Auto'].sort().join('|'), actual: names.join(' + ') || 'None' };
    },
  },
  {
    id: 'AT-09', storyId: 'US-05', label: 'Latest data-quality suite', expected: '6/6 pass',
    execute: async () => {
      const { data, error } = await supabase.from('vw_data_quality_latest').select('status');
      if (error) return { pass: false, actual: error.message };
      const passed = (data ?? []).filter((row) => row.status === 'pass').length;
      return { pass: passed === 6 && data?.length === 6, actual: `${passed}/${data?.length ?? 0} pass` };
    },
  },
  {
    id: 'AT-10', storyId: 'US-05', label: 'Critical controls are green', expected: 'Validity + reconciliation pass',
    execute: async () => {
      const { data, error } = await supabase.from('vw_data_quality_latest').select('check_name,status');
      if (error) return { pass: false, actual: error.message };
      const target = (data ?? []).filter((row) => row.check_name.includes('Incurred loss') || row.check_name.includes('reconciliation'));
      return { pass: target.length === 2 && target.every((row) => row.status === 'pass'), actual: `${target.filter((row) => row.status === 'pass').length}/2 pass` };
    },
  },
];

export async function executeAcceptance(test: AcceptanceCase): Promise<AcceptanceResult> {
  const started = performance.now();
  try {
    const output = await test.execute();
    return { ...test, status: output.pass ? 'pass' : 'fail', actual: output.actual, durationMs: Math.max(1, Math.round(performance.now() - started)) };
  } catch (error) {
    return { ...test, status: 'fail', actual: error instanceof Error ? error.message : 'Unexpected test error', durationMs: Math.max(1, Math.round(performance.now() - started)) };
  }
}
