export type RequirementStory = {
  id: string;
  role: string;
  want: string;
  soThat: string;
  priority: 'Must' | 'Should' | 'Could';
  criteria: { given: string; when: string; thenOutcome: string }[];
  tests: { id: string; label: string }[];
};

export const STORIES: RequirementStory[] = [
  {
    id: 'US-01', role: 'Underwriter', priority: 'Must',
    want: 'rate a policy from base rate, territory, tier and limits',
    soThat: 'I can quote an accurate, filed-rate premium',
    criteria: [{
      given: 'a Commercial Auto risk in Nebraska, Standard tier, $250K/$500K limit',
      when: 'I request a quote',
      thenOutcome: 'the engine applies base rate × territory × tier × limit factors and returns an annual premium',
    }],
    tests: [
      { id: 'AT-01', label: 'Base × territory × tier × limit reconciles to $6,136' },
      { id: 'AT-02', label: 'Changing territory to Colorado increases premium proportionally' },
    ],
  },
  {
    id: 'US-02', role: 'Agent', priority: 'Must',
    want: 'apply deductible credits and multi-policy discounts',
    soThat: 'I can present competitive options to the insured',
    criteria: [{
      given: 'a quote with a $2,500 deductible and multi-policy discount',
      when: 'both are selected',
      thenOutcome: 'the engine applies an 11% deductible credit and a ×0.90 discount multiplicatively',
    }],
    tests: [
      { id: 'AT-03', label: 'The deductible credit is applied before the discount' },
      { id: 'AT-04', label: 'Removing the discount restores the pre-discount premium' },
    ],
  },
  {
    id: 'US-03', role: 'Underwriter', priority: 'Should',
    want: 'surcharge risks with prior claims',
    soThat: 'pricing reflects loss experience',
    criteria: [{
      given: 'a risk with prior claims',
      when: 'the quote is calculated',
      thenOutcome: 'a +12% per-claim surcharge is applied and capped at +60%',
    }],
    tests: [
      { id: 'AT-05', label: 'Zero claims applies no surcharge and four claims applies 48%' },
      { id: 'AT-06', label: 'Five claims reaches, but never exceeds, the 60% cap' },
    ],
  },
  {
    id: 'US-04', role: 'Portfolio Analyst', priority: 'Must',
    want: 'see loss ratio by line of business from the warehouse',
    soThat: 'I can flag lines needing rate action',
    criteria: [{
      given: 'the published warehouse views',
      when: 'I open the Overview',
      thenOutcome: 'lines above a 100% loss ratio are flagged with a rate-adequacy alert',
    }],
    tests: [
      { id: 'AT-07', label: 'Loss ratio equals incurred loss ÷ written premium' },
      { id: 'AT-08', label: 'Homeowners and Personal Auto appear when each exceeds 100%' },
    ],
  },
  {
    id: 'US-05', role: 'Data Steward', priority: 'Must',
    want: 'automated data-quality checks after each load',
    soThat: 'I can trust the published numbers',
    criteria: [{
      given: 'a completed source-to-published load',
      when: 'sp_run_data_quality() runs',
      thenOutcome: 'reconciliation, integrity, completeness and validity checks are recorded with pass/fail',
    }],
    tests: [
      { id: 'AT-09', label: 'All six latest warehouse checks pass' },
      { id: 'AT-10', label: 'Incurred loss validity and premium reconciliation both pass' },
    ],
  },
];
