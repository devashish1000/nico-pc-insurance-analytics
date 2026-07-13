import type { View } from './navigation';
import { STORIES, type RequirementPriority, type RequirementStatus } from './requirements';

export const DELIVERY_HUB_DISCLAIMER =
  'Synthetic portfolio artifact. No NICO systems, employees, proprietary data, operating procedures, or approvals were used.';

export const WORKFLOW_DISCLAIMER =
  'The current-state sequence is a representative P&C delivery risk scenario, not a description of NICO operations. The target-state sequence is limited to behavior demonstrated in this portfolio app.';

export const RACI_DISCLAIMER =
  'Illustrative role model only. These assignments do not represent NICO reporting lines, staffing, or approvals.';

export type BusinessObjective = {
  id: string;
  title: string;
  outcome: string;
  evidenceMeasure: string;
  storyIds: string[];
};

export const BUSINESS_OBJECTIVES: BusinessObjective[] = [
  {
    id: 'OBJ-01',
    title: 'Accurate and explainable P&C quotes',
    outcome: 'Make synthetic rating inputs, business rules and calculated premium steps visible and reproducible.',
    evidenceMeasure: 'Six executable rating cases spanning base factors, credits, discounts and prior-claim surcharges.',
    storyIds: ['US-01', 'US-02', 'US-03'],
  },
  {
    id: 'OBJ-02',
    title: 'Actionable portfolio rate-adequacy insight',
    outcome: 'Use governed warehouse measures to identify synthetic lines requiring portfolio review.',
    evidenceMeasure: 'Two executable cases covering loss-ratio reconciliation and alert population.',
    storyIds: ['US-04'],
  },
  {
    id: 'OBJ-03',
    title: 'Trustworthy published warehouse data',
    outcome: 'Expose post-load evidence for reconciliation, integrity, completeness and validity controls.',
    evidenceMeasure: 'Two executable cases covering all six latest controls and the critical-control subset.',
    storyIds: ['US-05'],
  },
];

export type TraceabilityRecord = {
  objectiveId: string;
  epicId: string;
  storyId: string;
  storyTitle: string;
  role: string;
  priority: RequirementPriority;
  ownerRole: string;
  stakeholderRoles: string[];
  businessRule: string;
  dataRule?: string;
  sourceArtifacts: string[];
  testIds: string[];
  dependencies: string[];
  status: RequirementStatus;
  evidenceView: View;
  evidenceLabel: string;
};

export const TRACEABILITY_MATRIX: TraceabilityRecord[] = STORIES.map((story) => ({
  objectiveId: story.objectiveId,
  epicId: story.epicId,
  storyId: story.id,
  storyTitle: story.title,
  role: story.role,
  priority: story.priority,
  ownerRole: story.ownerRole,
  stakeholderRoles: story.stakeholderRoles,
  businessRule: story.businessRule,
  dataRule: story.dataRule,
  sourceArtifacts: story.sourceArtifacts,
  testIds: story.tests.map((test) => test.id),
  dependencies: story.dependencies,
  status: story.status,
  evidenceView: story.evidenceView,
  evidenceLabel: story.evidenceLabel,
}));

export type WorkflowMode = 'Illustrative as-is risk' | 'Demonstrated to-be pattern';

export type WorkflowStep = {
  id: string;
  actor: string;
  action: string;
  handoffOrControl: string;
  evidenceView?: View;
  evidenceLabel?: string;
};

export type WorkflowModel = {
  id: 'as-is' | 'to-be';
  title: WorkflowMode;
  summary: string;
  steps: WorkflowStep[];
};

export const WORKFLOWS: WorkflowModel[] = [
  {
    id: 'as-is',
    title: 'Illustrative as-is risk',
    summary: 'A representative manual-delivery pattern used only to make common handoff risks visible.',
    steps: [
      {
        id: 'AS-01',
        actor: 'Agent',
        action: 'Submits quote details through an unstructured request.',
        handoffOrControl: 'Risk: required inputs and decision context may be incomplete.',
      },
      {
        id: 'AS-02',
        actor: 'Underwriter',
        action: 'Rechecks rating factors across separate references.',
        handoffOrControl: 'Risk: duplicated lookup work and inconsistent rule interpretation.',
      },
      {
        id: 'AS-03',
        actor: 'IT Business Analyst',
        action: 'Resolves ambiguous rules after delivery has begun.',
        handoffOrControl: 'Risk: late clarification can create rework and test churn.',
      },
      {
        id: 'AS-04',
        actor: 'Data Engineer',
        action: 'Receives requirements through manual handoffs.',
        handoffOrControl: 'Risk: business intent, data rules and evidence can become disconnected.',
      },
      {
        id: 'AS-05',
        actor: 'QA Analyst',
        action: 'Reconstructs expected outcomes late in the cycle.',
        handoffOrControl: 'Risk: defects and missing edge cases are discovered after implementation.',
      },
      {
        id: 'AS-06',
        actor: 'Portfolio Analyst',
        action: 'Manually reconciles published metrics before using them.',
        handoffOrControl: 'Risk: decision support is delayed by trust and lineage questions.',
      },
    ],
  },
  {
    id: 'to-be',
    title: 'Demonstrated to-be pattern',
    summary: 'The connected delivery pattern that can be inspected and executed in this portfolio app.',
    steps: [
      {
        id: 'TO-01',
        actor: 'Agent / Underwriter',
        action: 'Enters structured synthetic rating inputs.',
        handoffOrControl: 'Control: constrained selections make the calculation inputs explicit.',
        evidenceView: 'rating',
        evidenceLabel: 'Rating Engine',
      },
      {
        id: 'TO-02',
        actor: 'IT Business Analyst',
        action: 'Connects each story to its rule, Given/When/Then criteria and test IDs.',
        handoffOrControl: 'Control: the traceability matrix preserves intent through validation.',
        evidenceView: 'requirements',
        evidenceLabel: 'Requirements & Tests',
      },
      {
        id: 'TO-03',
        actor: 'Data Engineer',
        action: 'Implements shared rating and warehouse logic.',
        handoffOrControl: 'Control: calculations and published views are the same evidence exercised by tests.',
        evidenceView: 'warehouse',
        evidenceLabel: 'Warehouse Architecture',
      },
      {
        id: 'TO-04',
        actor: 'IT Business Analyst / QA Analyst',
        action: 'Executes expected-versus-actual cases against rating logic and hosted views.',
        handoffOrControl: 'Control: ten on-demand tests expose pass/fail evidence and reproducible inputs.',
        evidenceView: 'requirements',
        evidenceLabel: 'Acceptance Test Runner',
      },
      {
        id: 'TO-05',
        actor: 'Data Steward',
        action: 'Reviews six post-load reconciliation and quality controls.',
        handoffOrControl: 'Control: the latest published checks show status, expected value and actual value.',
        evidenceView: 'dq',
        evidenceLabel: 'Data Quality',
      },
      {
        id: 'TO-06',
        actor: 'Portfolio Analyst',
        action: 'Uses governed loss ratios and synthetic rate-adequacy alerts.',
        handoffOrControl: 'Control: decision views remain traceable to published premium and loss facts.',
        evidenceView: 'overview',
        evidenceLabel: 'Portfolio Overview',
      },
    ],
  },
];

export type RaciCode = 'R' | 'A' | 'C' | 'I' | '-';
export type RaciRoleId =
  | 'it-business-analyst'
  | 'product-owner'
  | 'underwriting-sme'
  | 'data-engineer'
  | 'qa-analyst'
  | 'data-steward';

export type RaciRole = {
  id: RaciRoleId;
  label: string;
};

export const RACI_ROLES: RaciRole[] = [
  { id: 'it-business-analyst', label: 'IT Business Analyst' },
  { id: 'product-owner', label: 'Product Owner' },
  { id: 'underwriting-sme', label: 'Underwriting SME' },
  { id: 'data-engineer', label: 'Data Engineer' },
  { id: 'qa-analyst', label: 'QA Analyst' },
  { id: 'data-steward', label: 'Data Steward' },
];

export type RaciActivity = {
  id: string;
  label: string;
  assignments: Record<RaciRoleId, RaciCode>;
};

export const RACI_ACTIVITIES: RaciActivity[] = [
  {
    id: 'RACI-01',
    label: 'Define and prioritize business outcomes',
    assignments: {
      'it-business-analyst': 'R', 'product-owner': 'A', 'underwriting-sme': 'C',
      'data-engineer': 'I', 'qa-analyst': 'C', 'data-steward': 'I',
    },
  },
  {
    id: 'RACI-02',
    label: 'Confirm rating rules and edge cases',
    assignments: {
      'it-business-analyst': 'R', 'product-owner': 'A', 'underwriting-sme': 'C',
      'data-engineer': 'C', 'qa-analyst': 'C', 'data-steward': 'I',
    },
  },
  {
    id: 'RACI-03',
    label: 'Define warehouse mappings and quality rules',
    assignments: {
      'it-business-analyst': 'C', 'product-owner': 'I', 'underwriting-sme': 'C',
      'data-engineer': 'R', 'qa-analyst': 'C', 'data-steward': 'A',
    },
  },
  {
    id: 'RACI-04',
    label: 'Implement rating and warehouse behavior',
    assignments: {
      'it-business-analyst': 'C', 'product-owner': 'A', 'underwriting-sme': 'I',
      'data-engineer': 'R', 'qa-analyst': 'C', 'data-steward': 'C',
    },
  },
  {
    id: 'RACI-05',
    label: 'Validate acceptance criteria and UAT evidence',
    assignments: {
      'it-business-analyst': 'R', 'product-owner': 'A', 'underwriting-sme': 'C',
      'data-engineer': 'C', 'qa-analyst': 'R', 'data-steward': 'C',
    },
  },
  {
    id: 'RACI-06',
    label: 'Review delivery readiness',
    assignments: {
      'it-business-analyst': 'R', 'product-owner': 'A', 'underwriting-sme': 'C',
      'data-engineer': 'C', 'qa-analyst': 'C', 'data-steward': 'I',
    },
  },
];

export type GovernanceKind = 'Decision' | 'Assumption' | 'Dependency' | 'Open question';
export type GovernanceStatus = 'Adopted for demo' | 'Validated in code' | 'External dependency' | 'Open';

export type GovernanceItem = {
  id: string;
  kind: GovernanceKind;
  title: string;
  detail: string;
  status: GovernanceStatus;
  evidenceView?: View;
};

export const GOVERNANCE_ITEMS: GovernanceItem[] = [
  {
    id: 'D-01', kind: 'Decision', title: 'Use synthetic data only', status: 'Validated in code',
    detail: 'The portfolio work sample uses synthetic policy and claim data and does not use PII.',
  },
  {
    id: 'D-02', kind: 'Decision', title: 'Demonstrate warehouse patterns in Supabase Postgres', status: 'Adopted for demo',
    detail: 'Implemented Postgres patterns are demonstrated directly; Azure SQL, Synapse and ADF remain a documented design-only transfer map.',
    evidenceView: 'azure',
  },
  {
    id: 'D-03', kind: 'Decision', title: 'Keep the rating model illustrative', status: 'Validated in code',
    detail: 'The premium calculator demonstrates traceable rating behavior but is not a filed rating plan.',
    evidenceView: 'rating',
  },
  {
    id: 'D-04', kind: 'Decision', title: 'Reorder shared evidence by hiring perspective', status: 'Validated in code',
    detail: 'The two persona journeys change evidence order without duplicating work or creating different claims.',
  },
  {
    id: 'A-01', kind: 'Assumption', title: 'P&C personas are representative', status: 'Adopted for demo',
    detail: 'The personas and workflow are representative of a synthetic P&C scenario and are not descriptions of NICO operating procedures.',
  },
  {
    id: 'A-02', kind: 'Assumption', title: 'Use 100% loss ratio as a demo alert threshold', status: 'Adopted for demo',
    detail: 'The threshold supports the portfolio scenario and is not presented as a NICO underwriting or rate-action rule.',
    evidenceView: 'overview',
  },
  {
    id: 'A-03', kind: 'Assumption', title: 'Use synthetic premiums and factors', status: 'Validated in code',
    detail: 'Displayed premiums, factors, discounts and surcharges are illustrative and are not filed rates.',
    evidenceView: 'rating',
  },
  {
    id: 'DEP-01', kind: 'Dependency', title: 'Hosted analytics views', status: 'External dependency',
    detail: 'Acceptance cases AT-07 through AT-10 require the hosted Supabase analytics and data-quality views.',
  },
  {
    id: 'DEP-02', kind: 'Dependency', title: 'Controlled pipeline credentials', status: 'External dependency',
    detail: 'Manual pipeline execution depends on server-only credentials and the same-origin Vercel Function boundary.',
    evidenceView: 'pipeline',
  },
  {
    id: 'DEP-03', kind: 'Dependency', title: 'Browser network access', status: 'External dependency',
    detail: 'Hosted warehouse acceptance cases require network access; deterministic rating cases run in the browser.',
  },
  {
    id: 'Q-01', kind: 'Open question', title: 'Target Azure services', status: 'Open',
    detail: 'Which Azure landing, orchestration and warehouse services would govern a target implementation?',
    evidenceView: 'azure',
  },
  {
    id: 'Q-02', kind: 'Open question', title: 'Rating-change approval path', status: 'Open',
    detail: 'What approval path governs rating changes, referrals and policy exceptions?',
  },
  {
    id: 'Q-03', kind: 'Open question', title: 'Freshness and availability service levels', status: 'Open',
    detail: 'What freshness, availability and incident-response expectations apply to executive views?',
  },
  {
    id: 'Q-04', kind: 'Open question', title: 'Jira or Rally delivery contract', status: 'Open',
    detail: 'Which work-management fields, states and links should receive stories and test evidence?',
  },
];

export type BacklogSize = 'S' | 'M' | 'L';
export type BacklogStatus = 'Candidate' | 'Planned' | 'Demonstrated';

export type BacklogItem = {
  id: string;
  title: string;
  priority: RequirementPriority;
  size: BacklogSize;
  businessValue: string;
  acceptanceSummary: string;
  status: BacklogStatus;
  dependencies: string[];
};

export const PRIORITIZED_BACKLOG: BacklogItem[] = [
  {
    id: 'PB-01',
    title: 'Quote referral, override and exception workflow',
    priority: 'Must',
    size: 'M',
    businessValue: 'Extend the rating scenario from calculation into cross-functional exception handling.',
    acceptanceSummary: 'Show referral triggers, owner, reason, decision, audit note and the approved return path to quoting.',
    status: 'Candidate',
    dependencies: ['Illustrative approval policy', 'Synthetic exception scenarios'],
  },
  {
    id: 'PB-02',
    title: 'Field-level source-to-target mapping and business glossary',
    priority: 'Must',
    size: 'M',
    businessValue: 'Connect business definitions to warehouse fields and quality controls.',
    acceptanceSummary: 'Map core premium, loss, policy and effective-date fields to transformation rules, targets and owners.',
    status: 'Candidate',
    dependencies: ['Approved synthetic data dictionary scope'],
  },
  {
    id: 'PB-03',
    title: 'Data-freshness SLA and non-functional acceptance tests',
    priority: 'Should',
    size: 'S',
    businessValue: 'Make timeliness and operational expectations testable alongside functional requirements.',
    acceptanceSummary: 'Expose latest-publish time and test it against a clearly labeled synthetic freshness target.',
    status: 'Candidate',
    dependencies: ['Pipeline publish timestamp', 'Illustrative freshness target'],
  },
  {
    id: 'PB-04',
    title: 'Export RTM and acceptance evidence with timestamp and version',
    priority: 'Should',
    size: 'S',
    businessValue: 'Make delivery evidence portable for review without changing the underlying source of truth.',
    acceptanceSummary: 'Export story, rule, test, expected, actual, status, run time and application version.',
    status: 'Candidate',
    dependencies: ['Acceptance-run result state', 'Application version identifier'],
  },
  {
    id: 'PB-05',
    title: 'Jira or Rally-compatible story and test export contract',
    priority: 'Could',
    size: 'M',
    businessValue: 'Demonstrate how portfolio artifacts could transfer into an enterprise delivery workflow.',
    acceptanceSummary: 'Document a tool-neutral export schema without claiming access to a NICO work-management system.',
    status: 'Candidate',
    dependencies: ['Target work-management field mapping'],
  },
];

export type UatReadinessStatus = 'Complete' | 'Available' | 'Not performed';

export type UatReadinessCheck = {
  id: string;
  label: string;
  status: UatReadinessStatus;
  evidence: string;
};

export type UatReadinessRecord = {
  title: string;
  decision: string;
  scope: string;
  reviewer: string;
  approval: string;
  disclaimer: string;
  checks: UatReadinessCheck[];
};

export const UAT_READINESS: UatReadinessRecord = {
  title: 'Synthetic UAT readiness — portfolio simulation',
  decision: 'Demo-ready after an on-demand acceptance run',
  scope: 'Five synthetic stories and ten executable cases covering rating, portfolio analytics and data quality.',
  reviewer: 'Author self-review only',
  approval: 'Not applicable',
  disclaimer: 'Illustrative readiness artifact only. No NICO stakeholder reviewed or approved this work, and this is not production UAT.',
  checks: [
    {
      id: 'UAT-01',
      label: 'Five stories mapped to acceptance criteria',
      status: 'Complete',
      evidence: 'Every story contains Given/When/Then criteria and traceable test IDs.',
    },
    {
      id: 'UAT-02',
      label: 'Ten executable tests available',
      status: 'Available',
      evidence: 'The acceptance runner executes six deterministic rating cases and four hosted warehouse cases.',
    },
    {
      id: 'UAT-03',
      label: 'Four rating cases deep-link to exact inputs',
      status: 'Complete',
      evidence: 'AT-01 through AT-04 carry reproducible RatingInput payloads into the rating engine.',
    },
    {
      id: 'UAT-04',
      label: 'Four warehouse and data-quality cases use hosted evidence',
      status: 'Available',
      evidence: 'AT-07 through AT-10 query published Supabase views when the hosted dependency is available.',
    },
    {
      id: 'UAT-05',
      label: 'NICO stakeholder validation',
      status: 'Not performed',
      evidence: 'No NICO stakeholder participated in or approved this portfolio artifact.',
    },
    {
      id: 'UAT-06',
      label: 'Production readiness assessment',
      status: 'Not performed',
      evidence: 'The app is a synthetic work sample and has not been assessed for a NICO production environment.',
    },
  ],
};
