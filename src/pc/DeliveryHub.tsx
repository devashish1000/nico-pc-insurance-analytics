import type { KeyboardEvent } from 'react';
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  GitCompareArrows,
  ListChecks,
  Network,
  Scale,
  ShieldAlert,
} from 'lucide-react';
import {
  BUSINESS_OBJECTIVES,
  DELIVERY_HUB_DISCLAIMER,
  GOVERNANCE_ITEMS,
  PRIORITIZED_BACKLOG,
  RACI_ACTIVITIES,
  RACI_DISCLAIMER,
  RACI_ROLES,
  TRACEABILITY_MATRIX,
  UAT_READINESS,
  WORKFLOW_DISCLAIMER,
  WORKFLOWS,
  type GovernanceKind,
  type RaciCode,
} from '../lib/businessAnalysis';
import {
  defaultDeliveryTab,
  type DeliveryTab,
  type View,
} from '../lib/navigation';
import { Badge, Card, SectionTitle } from './ui';

export { defaultDeliveryTab, isDeliveryTab } from '../lib/navigation';
export type { DeliveryTab } from '../lib/navigation';

export const DELIVERY_HUB_TABS: { id: DeliveryTab; label: string; icon: typeof ListChecks }[] = [
  { id: 'traceability', label: 'Traceability', icon: ListChecks },
  { id: 'workflow', label: 'As-Is / To-Be', icon: GitCompareArrows },
  { id: 'raci', label: 'RACI', icon: Network },
  { id: 'governance', label: 'Governance', icon: Scale },
  { id: 'backlog', label: 'Backlog', icon: BriefcaseBusiness },
  { id: 'uat', label: 'UAT Readiness', icon: ShieldAlert },
];

export type DeliveryHubProps = {
  activeTab: DeliveryTab;
  onTabChange: (tab: DeliveryTab) => void;
  onNavigate: (view: View, testId?: string) => void;
};

const priorityTone = { Must: 'red', Should: 'amber', Could: 'slate' } as const;
const statusTone = { Executable: 'green', Demonstrated: 'blue', 'Design only': 'slate' } as const;
const governanceKinds: GovernanceKind[] = ['Decision', 'Assumption', 'Dependency', 'Open question'];
const raciLabels: Record<RaciCode, string> = {
  R: 'Responsible', A: 'Accountable', C: 'Consulted', I: 'Informed', '-': 'No assignment',
};

function TraceabilityPanel({ onNavigate }: Pick<DeliveryHubProps, 'onNavigate'>) {
  const objectives = new Map(BUSINESS_OBJECTIVES.map((objective) => [objective.id, objective]));
  const testCount = TRACEABILITY_MATRIX.reduce((count, record) => count + record.testIds.length, 0);

  return (
    <div className="delivery-traceability">
      <div className="delivery-hub-summary" aria-label="Traceability coverage">
        <Card className="delivery-summary-card"><span>Business objectives</span><strong>{BUSINESS_OBJECTIVES.length}</strong></Card>
        <Card className="delivery-summary-card"><span>User stories</span><strong>{TRACEABILITY_MATRIX.length}</strong></Card>
        <Card className="delivery-summary-card"><span>Acceptance tests</span><strong>{testCount}</strong></Card>
        <Card className="delivery-summary-card"><span>Orphan records</span><strong>0</strong></Card>
      </div>

      <div className="delivery-objectives" aria-label="Business objectives">
        {BUSINESS_OBJECTIVES.map((objective) => (
          <Card className="delivery-objective-card" key={objective.id}>
            <span className="section-kicker">{objective.id}</span>
            <h3>{objective.title}</h3>
            <p>{objective.outcome}</p>
            <small>{objective.evidenceMeasure}</small>
          </Card>
        ))}
      </div>

      <div className="delivery-table-wrap delivery-rtm-wrap">
        <table className="delivery-table delivery-rtm-table">
          <caption>Requirements traceability from business objective through executable evidence</caption>
          <thead>
            <tr>
              <th scope="col">Objective / story</th>
              <th scope="col">Role / owner</th>
              <th scope="col">Business and data rules</th>
              <th scope="col">Source artifacts</th>
              <th scope="col">Tests</th>
              <th scope="col">Evidence</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {TRACEABILITY_MATRIX.map((record) => (
              <tr key={record.storyId}>
                <td>
                  <strong>{record.objectiveId} · {record.epicId} · {record.storyId}</strong>
                  <span>{objectives.get(record.objectiveId)?.title}</span>
                  <span>{record.storyTitle}</span>
                  <Badge tone={priorityTone[record.priority]}>{record.priority}</Badge>
                </td>
                <td>
                  <strong>{record.role}</strong>
                  <span>Illustrative owner: {record.ownerRole}</span>
                  <span>{record.stakeholderRoles.join(' · ')}</span>
                </td>
                <td>
                  <strong>Business</strong><span>{record.businessRule}</span>
                  {record.dataRule && <><strong>Data</strong><span>{record.dataRule}</span></>}
                </td>
                <td>{record.sourceArtifacts.map((artifact) => <code key={artifact}>{artifact}</code>)}</td>
                <td>{record.testIds.map((testId) => <code key={testId}>{testId}</code>)}</td>
                <td>
                  <button className="delivery-evidence-link" onClick={() => onNavigate(record.evidenceView)}>
                    {record.evidenceLabel}<ExternalLink size={14} aria-hidden="true" />
                  </button>
                </td>
                <td><Badge tone={statusTone[record.status]}>{record.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WorkflowPanel({ onNavigate }: Pick<DeliveryHubProps, 'onNavigate'>) {
  return (
    <div className="delivery-workflow-panel">
      <div className="delivery-truth-note" role="note"><CircleAlert size={18} aria-hidden="true" /><p>{WORKFLOW_DISCLAIMER}</p></div>
      <div className="delivery-workflows">
        {WORKFLOWS.map((workflow) => (
          <section className={`delivery-workflow delivery-workflow-${workflow.id}`} key={workflow.id} aria-labelledby={`workflow-${workflow.id}`}>
            <div className="delivery-workflow-heading">
              <span className="section-kicker">{workflow.id === 'as-is' ? 'Representative risk scenario' : 'Portfolio evidence'}</span>
              <h2 id={`workflow-${workflow.id}`}>{workflow.title}</h2>
              <p>{workflow.summary}</p>
            </div>
            <ol className="delivery-workflow-steps">
              {workflow.steps.map((step, index) => (
                <li key={step.id}>
                  <div className="delivery-workflow-number" aria-hidden="true">{index + 1}</div>
                  <div>
                    <span className="section-kicker">{step.id} · {step.actor}</span>
                    <h3>{step.action}</h3>
                    <p>{step.handoffOrControl}</p>
                    {step.evidenceView && (
                      <button className="delivery-evidence-link" onClick={() => onNavigate(step.evidenceView!)}>
                        Inspect {step.evidenceLabel}<ArrowRight size={14} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}

function RaciPanel() {
  return (
    <div className="delivery-raci-panel">
      <div className="delivery-truth-note" role="note"><CircleAlert size={18} aria-hidden="true" /><p>{RACI_DISCLAIMER}</p></div>
      <div className="delivery-raci-legend" aria-label="RACI legend">
        {(['R', 'A', 'C', 'I'] as RaciCode[]).map((code) => <span key={code}><b>{code}</b>{raciLabels[code]}</span>)}
      </div>
      <div className="delivery-table-wrap delivery-raci-wrap">
        <table className="delivery-table delivery-raci-table">
          <caption>Illustrative responsibility assignment matrix</caption>
          <thead>
            <tr><th scope="col">Delivery activity</th>{RACI_ROLES.map((role) => <th scope="col" key={role.id}>{role.label}</th>)}</tr>
          </thead>
          <tbody>
            {RACI_ACTIVITIES.map((activity) => (
              <tr key={activity.id}>
                <th scope="row"><span>{activity.id}</span>{activity.label}</th>
                {RACI_ROLES.map((role) => {
                  const code = activity.assignments[role.id];
                  return <td key={role.id}><span className={`delivery-raci-code delivery-raci-${code.toLowerCase()}`} aria-label={raciLabels[code]}>{code}</span></td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GovernancePanel({ onNavigate }: Pick<DeliveryHubProps, 'onNavigate'>) {
  return (
    <div className="delivery-governance-panel">
      <div className="delivery-governance-groups">
        {governanceKinds.map((kind) => {
          const items = GOVERNANCE_ITEMS.filter((item) => item.kind === kind);
          return (
            <section className="delivery-governance-group" key={kind} aria-labelledby={`governance-${kind.replace(' ', '-').toLowerCase()}`}>
              <div className="delivery-governance-heading">
                <h2 id={`governance-${kind.replace(' ', '-').toLowerCase()}`}>{kind}s</h2>
                <span>{items.length}</span>
              </div>
              <div className="delivery-governance-items">
                {items.map((item) => (
                  <Card className="delivery-governance-item" key={item.id}>
                    <div><span className="section-kicker">{item.id}</span><Badge tone={item.status === 'Open' ? 'amber' : item.status === 'External dependency' ? 'slate' : 'green'}>{item.status}</Badge></div>
                    <h3>{item.title}</h3>
                    <p>{item.detail}</p>
                    {item.evidenceView && <button className="delivery-evidence-link" onClick={() => onNavigate(item.evidenceView!)}>Inspect evidence<ExternalLink size={14} aria-hidden="true" /></button>}
                  </Card>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function BacklogPanel() {
  return (
    <div className="delivery-backlog-panel">
      <div className="delivery-candidate-note" role="note">
        <BriefcaseBusiness size={18} aria-hidden="true" />
        <p><strong>Candidate backlog only.</strong> These items are proposed next increments, not completed features or NICO commitments.</p>
      </div>
      <div className="delivery-table-wrap delivery-backlog-wrap">
        <table className="delivery-table delivery-backlog-table">
          <caption>Prioritized candidate backlog</caption>
          <thead><tr><th scope="col">Item</th><th scope="col">Priority / size</th><th scope="col">Business value</th><th scope="col">Acceptance summary</th><th scope="col">Dependencies</th><th scope="col">Status</th></tr></thead>
          <tbody>
            {PRIORITIZED_BACKLOG.map((item) => (
              <tr key={item.id}>
                <td><strong>{item.id}</strong><span>{item.title}</span></td>
                <td><Badge tone={priorityTone[item.priority]}>{item.priority}</Badge><span>Size {item.size}</span></td>
                <td>{item.businessValue}</td>
                <td>{item.acceptanceSummary}</td>
                <td><ul>{item.dependencies.map((dependency) => <li key={dependency}>{dependency}</li>)}</ul></td>
                <td><Badge tone="slate">{item.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UatPanel({ onNavigate }: Pick<DeliveryHubProps, 'onNavigate'>) {
  return (
    <div className="delivery-uat-panel">
      <div className="delivery-uat-warning" role="note">
        <ShieldAlert size={24} aria-hidden="true" />
        <div>
          <span className="section-kicker">Truthful scope boundary</span>
          <h2>No NICO stakeholder validation · No production approval</h2>
          <p>{UAT_READINESS.disclaimer}</p>
        </div>
      </div>
      <div className="delivery-uat-decision">
        <Card className="delivery-uat-decision-card">
          <span className="section-kicker">Readiness decision</span>
          <h2>{UAT_READINESS.decision}</h2>
          <p>{UAT_READINESS.scope}</p>
          <dl><div><dt>Reviewer</dt><dd>{UAT_READINESS.reviewer}</dd></div><div><dt>Approval</dt><dd>{UAT_READINESS.approval}</dd></div></dl>
          <button className="button-primary" onClick={() => onNavigate('requirements')}>Open acceptance evidence<ArrowRight size={16} aria-hidden="true" /></button>
        </Card>
        <div className="delivery-uat-checks" aria-label="UAT readiness checks">
          {UAT_READINESS.checks.map((check) => (
            <Card className={`delivery-uat-check delivery-uat-${check.status.replace(' ', '-').toLowerCase()}`} key={check.id}>
              <div>{check.status === 'Not performed' ? <ShieldAlert size={19} aria-hidden="true" /> : <CheckCircle2 size={19} aria-hidden="true" />}<span className="section-kicker">{check.id} · {check.status}</span></div>
              <h3>{check.label}</h3>
              <p>{check.evidence}</p>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function renderPanel(activeTab: DeliveryTab, onNavigate: DeliveryHubProps['onNavigate']) {
  switch (activeTab) {
    case 'traceability': return <TraceabilityPanel onNavigate={onNavigate} />;
    case 'workflow': return <WorkflowPanel onNavigate={onNavigate} />;
    case 'raci': return <RaciPanel />;
    case 'governance': return <GovernancePanel onNavigate={onNavigate} />;
    case 'backlog': return <BacklogPanel />;
    case 'uat': return <UatPanel onNavigate={onNavigate} />;
  }
}

export default function DeliveryHub({ activeTab = defaultDeliveryTab, onTabChange, onNavigate }: DeliveryHubProps) {
  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | undefined;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % DELIVERY_HUB_TABS.length;
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + DELIVERY_HUB_TABS.length) % DELIVERY_HUB_TABS.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = DELIVERY_HUB_TABS.length - 1;
    if (nextIndex == null) return;

    event.preventDefault();
    const next = DELIVERY_HUB_TABS[nextIndex];
    onTabChange(next.id);
    window.requestAnimationFrame(() => document.getElementById(`delivery-tab-${next.id}`)?.focus());
  };

  return (
    <div className="delivery-hub">
      <SectionTitle
        title="IT Business Analyst Delivery Hub"
        subtitle="Trace synthetic P&C business objectives through requirements, cross-functional delivery artifacts, executable evidence, and explicit scope boundaries."
        icon={<BriefcaseBusiness size={20} />}
      />

      <div className="delivery-hub-disclaimer" role="note"><CircleAlert size={18} aria-hidden="true" /><p>{DELIVERY_HUB_DISCLAIMER}</p></div>

      <div className="delivery-hub-tabs" role="tablist" aria-label="Business analysis delivery artifacts">
        {DELIVERY_HUB_TABS.map(({ id, label, icon: Icon }, index) => (
          <button
            id={`delivery-tab-${id}`}
            className={activeTab === id ? 'delivery-hub-tab active' : 'delivery-hub-tab'}
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            aria-controls={`delivery-panel-${id}`}
            tabIndex={activeTab === id ? 0 : -1}
            onClick={() => onTabChange(id)}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
          >
            <Icon size={16} aria-hidden="true" />{label}
          </button>
        ))}
      </div>

      <section
        id={`delivery-panel-${activeTab}`}
        className={`delivery-hub-panel delivery-hub-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`delivery-tab-${activeTab}`}
        tabIndex={0}
      >
        {renderPanel(activeTab, onNavigate)}
      </section>
    </div>
  );
}
