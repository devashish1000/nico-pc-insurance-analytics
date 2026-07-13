import type { View } from './navigation';

export type RequirementPriority = 'Must' | 'Should' | 'Could';
export type RequirementStatus = 'Executable' | 'Demonstrated' | 'Design only';

export type AcceptanceCriterion = {
  given: string;
  when: string;
  thenOutcome: string;
};

export type RequirementTest = {
  id: string;
  label: string;
};

export type RequirementStory = {
  id: string;
  title: string;
  epicId: string;
  objectiveId: string;
  role: string;
  want: string;
  soThat: string;
  priority: RequirementPriority;
  ownerRole: string;
  stakeholderRoles: string[];
  businessRule: string;
  dataRule?: string;
  sourceArtifacts: string[];
  dependencies: string[];
  status: RequirementStatus;
  evidenceView: View;
  evidenceLabel: string;
  criteria: AcceptanceCriterion[];
  tests: RequirementTest[];
};

export const STORIES: RequirementStory[] = [
  {
    id: 'US-01',
    title: 'Calculate a base indicated premium',
    epicId: 'EP-01',
    objectiveId: 'OBJ-01',
    role: 'Underwriter',
    priority: 'Must',
    want: 'rate a policy from base rate, territory, tier and limits',
    soThat: 'I can explain and reproduce an illustrative premium calculation',
    ownerRole: 'Underwriting Product Owner',
    stakeholderRoles: ['Underwriter SME', 'IT Business Analyst', 'Rating Engineer', 'QA Analyst'],
    businessRule: 'Apply base rate, territory, risk-tier and liability-limit factors multiplicatively.',
    dataRule: 'The selected line, territory, tier and limit codes must resolve to one configured factor each.',
    sourceArtifacts: ['src/lib/ratingModel.ts'],
    dependencies: ['Synthetic rating-factor configuration', 'Rating-engine calculation service'],
    status: 'Executable',
    evidenceView: 'rating',
    evidenceLabel: 'P&C Rating & Quote Engine',
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
    id: 'US-02',
    title: 'Apply deductible credits and discounts',
    epicId: 'EP-01',
    objectiveId: 'OBJ-01',
    role: 'Agent',
    priority: 'Must',
    want: 'apply deductible credits and multi-policy discounts',
    soThat: 'I can present competitive options to the insured',
    ownerRole: 'Agency Product Owner',
    stakeholderRoles: ['Agent SME', 'IT Business Analyst', 'Rating Engineer', 'QA Analyst'],
    businessRule: 'Apply the deductible credit before multiplicative policy discounts.',
    dataRule: 'A selected deductible resolves to one credit percentage; each selected discount is applied once.',
    sourceArtifacts: ['src/lib/ratingModel.ts'],
    dependencies: ['Synthetic deductible and discount configuration', 'Rating-engine calculation service'],
    status: 'Executable',
    evidenceView: 'rating',
    evidenceLabel: 'P&C Rating & Quote Engine',
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
    id: 'US-03',
    title: 'Apply a capped prior-claims surcharge',
    epicId: 'EP-01',
    objectiveId: 'OBJ-01',
    role: 'Underwriter',
    priority: 'Should',
    want: 'surcharge risks with prior claims',
    soThat: 'pricing reflects loss experience',
    ownerRole: 'Underwriting Product Owner',
    stakeholderRoles: ['Underwriter SME', 'IT Business Analyst', 'Rating Engineer', 'QA Analyst'],
    businessRule: 'Apply a 12% surcharge per prior claim and cap the total surcharge at 60%.',
    dataRule: 'Prior-claim count is constrained to zero through five for this illustrative model.',
    sourceArtifacts: ['src/lib/ratingModel.ts'],
    dependencies: ['Synthetic prior-claim input', 'Rating-engine calculation service'],
    status: 'Executable',
    evidenceView: 'rating',
    evidenceLabel: 'P&C Rating & Quote Engine',
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
    id: 'US-04',
    title: 'Surface line-of-business rate-adequacy alerts',
    epicId: 'EP-02',
    objectiveId: 'OBJ-02',
    role: 'Portfolio Analyst',
    priority: 'Must',
    want: 'see loss ratio by line of business from the warehouse',
    soThat: 'I can flag lines needing rate action',
    ownerRole: 'Portfolio Analytics Lead',
    stakeholderRoles: ['Portfolio Analyst', 'IT Business Analyst', 'Data Engineer', 'Data Steward'],
    businessRule: 'Flag a synthetic line of business when its loss ratio exceeds 100%.',
    dataRule: 'Loss ratio equals incurred loss divided by written premium, expressed as a percentage.',
    sourceArtifacts: ['vw_loss_ratio_by_lob', 'src/pc/Overview.tsx'],
    dependencies: ['Published premium and loss facts', 'Hosted analytics view availability'],
    status: 'Executable',
    evidenceView: 'overview',
    evidenceLabel: 'Portfolio Overview',
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
    id: 'US-05',
    title: 'Validate published warehouse data after each load',
    epicId: 'EP-03',
    objectiveId: 'OBJ-03',
    role: 'Data Steward',
    priority: 'Must',
    want: 'automated data-quality checks after each load',
    soThat: 'I can trust the published numbers',
    ownerRole: 'Data Steward',
    stakeholderRoles: ['Data Steward', 'IT Business Analyst', 'Data Engineer', 'QA Analyst'],
    businessRule: 'Record pass/fail evidence for reconciliation, integrity, completeness and validity controls.',
    dataRule: 'The latest published quality view must expose all six checks and their current status.',
    sourceArtifacts: ['sp_run_data_quality()', 'vw_data_quality_latest'],
    dependencies: ['Completed source-to-published load', 'Hosted data-quality view availability'],
    status: 'Executable',
    evidenceView: 'dq',
    evidenceLabel: 'Data Quality',
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
