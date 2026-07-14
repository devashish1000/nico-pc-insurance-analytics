import { CheckSquare, ChevronDown, ClipboardList, ExternalLink, Play, RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import AcceptanceRunner from '../components/AcceptanceRunner';
import {
  DEFAULT_REQUIREMENT_FILTERS,
  filterRequirementStories,
  requirementRoles,
  requirementStatuses,
  type RequirementFilters,
} from '../lib/requirementFilters';
import type { View } from '../lib/navigation';
import { STORIES, type RequirementPriority, type RequirementStatus } from '../lib/requirements';
import { Badge, SectionTitle } from './ui';

const priorityTone = { Must: 'red', Should: 'amber', Could: 'slate' } as const;
const statusTone = { Executable: 'green', Demonstrated: 'blue', 'Design only': 'slate' } as const;

export default function Requirements({ onNavigate }: { onNavigate: (view: View, testId?: string) => void }) {
  const [requestedStory, setRequestedStory] = useState<string>();
  const [filters, setFilters] = useState<RequirementFilters>({ ...DEFAULT_REQUIREMENT_FILTERS });
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['US-01']));

  const roles = useMemo(() => requirementRoles(STORIES), []);
  const statuses = useMemo(() => requirementStatuses(STORIES), []);
  const filteredStories = useMemo(() => filterRequirementStories(STORIES, filters), [filters]);
  const criteriaCount = STORIES.reduce((count, story) => count + story.criteria.length, 0);
  const testCount = STORIES.reduce((count, story) => count + story.tests.length, 0);

  const updateFilter = <K extends keyof RequirementFilters>(key: K, value: RequirementFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const setStoryOpen = (storyId: string, open: boolean) => {
    setExpanded((current) => {
      if (current.has(storyId) === open) return current;
      const next = new Set(current);
      if (open) next.add(storyId);
      else next.delete(storyId);
      return next;
    });
  };

  const expandFiltered = () => setExpanded((current) => new Set([...current, ...filteredStories.map((story) => story.id)]));
  const collapseFiltered = () => setExpanded((current) => {
    const next = new Set(current);
    filteredStories.forEach((story) => next.delete(story.id));
    return next;
  });

  const resetFilters = () => setFilters({ ...DEFAULT_REQUIREMENT_FILTERS });

  return (
    <div className="requirements-workbench">
      <SectionTitle
        title="Requirements & Acceptance Criteria"
        subtitle="INVEST user stories with executable Given/When/Then evidence, MoSCoW priority, delivery metadata, and traceability into the rating engine and warehouse."
        icon={<ClipboardList size={20} />}
      />

      <AcceptanceRunner onNavigate={onNavigate} requestedStory={requestedStory} onStoryHandled={() => setRequestedStory(undefined)} />

      <div className="requirement-summary requirements-proof-summary" aria-label="Requirement and acceptance coverage">
        <div><span>User stories</span><strong>{STORIES.length}</strong></div>
        <div><span>Acceptance criteria</span><strong>{criteriaCount}</strong></div>
        <div><span>Executable tests</span><strong>{testCount}</strong></div>
        <div><span>Filtered stories</span><strong>{filteredStories.length}</strong></div>
      </div>

      <section className="requirements-filter-panel data-surface" aria-labelledby="requirement-filter-title">
        <div className="requirements-filter-heading">
          <div>
            <span className="section-kicker">Client-side discovery</span>
            <h2 id="requirement-filter-title">Filter requirement evidence</h2>
            <p>Filters narrow the story cards only. The acceptance runner above always retains all {testCount} executable tests.</p>
          </div>
          <button className="button-quiet requirements-reset" type="button" onClick={resetFilters}><RotateCcw size={15} aria-hidden="true" />Reset filters</button>
        </div>

        <div className="requirements-filter-grid">
          <label>
            <span>Search requirements</span>
            <input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="ID, title, role, owner, source…" />
          </label>
          <label>
            <span>Priority</span>
            <select value={filters.priority} onChange={(event) => updateFilter('priority', event.target.value as 'All' | RequirementPriority)}>
              <option value="All">All priorities</option>
              <option value="Must">Must</option>
              <option value="Should">Should</option>
              <option value="Could">Could</option>
            </select>
          </label>
          <label>
            <span>Role</span>
            <select value={filters.role} onChange={(event) => updateFilter('role', event.target.value)}>
              <option value="All">All roles</option>
              {roles.map((role) => <option value={role} key={role}>{role}</option>)}
            </select>
          </label>
          <label>
            <span>Evidence status</span>
            <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value as 'All' | RequirementStatus)}>
              <option value="All">All statuses</option>
              {statuses.map((status) => <option value={status} key={status}>{status}</option>)}
            </select>
          </label>
          <label>
            <span>Business or data rule</span>
            <input value={filters.rule} onChange={(event) => updateFilter('rule', event.target.value)} placeholder="loss ratio, surcharge, reconciliation…" />
          </label>
          <label>
            <span>Test ID or expected behavior</span>
            <input value={filters.test} onChange={(event) => updateFilter('test', event.target.value)} placeholder="AT-07, discount, quality…" />
          </label>
        </div>

        <div className="requirements-filter-actions">
          <p aria-live="polite">Showing <strong>{filteredStories.length}</strong> of {STORIES.length} stories.</p>
          <div>
            <button className="button-quiet" type="button" onClick={expandFiltered} disabled={filteredStories.length === 0}>Expand all shown</button>
            <button className="button-quiet" type="button" onClick={collapseFiltered} disabled={filteredStories.length === 0}>Collapse all shown</button>
          </div>
        </div>
      </section>

      <div className="requirements-list requirements-details-list">
        {filteredStories.map((story) => (
          <details
            className="data-surface requirement-card requirement-detail-card"
            key={story.id}
            open={expanded.has(story.id)}
            onToggle={(event) => setStoryOpen(story.id, event.currentTarget.open)}
          >
            <summary className="requirement-detail-summary">
              <span className="requirement-summary-chevron" aria-hidden="true"><ChevronDown size={18} /></span>
              <span className="story-id">{story.id}</span>
              <span className="requirement-summary-title">{story.title}</span>
              <Badge tone={priorityTone[story.priority]}>{story.priority}</Badge>
              <Badge tone={statusTone[story.status]}>{story.status}</Badge>
              <span className="requirement-summary-role">{story.role}</span>
              <span className="requirement-summary-tests">{story.tests.length} tests</span>
            </summary>

            <div className="requirement-detail-body">
              <p className="requirement-story-statement">As a <strong>{story.role}</strong>, I want to <strong>{story.want}</strong>, so that {story.soThat}.</p>

              <div className="requirement-delivery-metadata">
                <div><span className="section-kicker">Traceability</span><p><strong>{story.objectiveId}</strong> · {story.epicId} · {story.id}</p></div>
                <div><span className="section-kicker">Illustrative owner</span><p>{story.ownerRole}</p></div>
                <div><span className="section-kicker">Stakeholders</span><p>{story.stakeholderRoles.join(' · ')}</p></div>
                <div><span className="section-kicker">Source artifacts</span><p>{story.sourceArtifacts.map((artifact) => <code key={artifact}>{artifact}</code>)}</p></div>
              </div>

              <div className="requirement-rules-grid">
                <div><span className="section-kicker">Business rule</span><p>{story.businessRule}</p></div>
                <div><span className="section-kicker">Data rule</span><p>{story.dataRule ?? 'No separate data rule is required for this story.'}</p></div>
              </div>

              <div className="requirement-grid requirement-evidence-grid">
                <div>
                  <span className="section-kicker">Given / When / Then</span>
                  {story.criteria.map((criterion) => (
                    <p key={criterion.given}><strong>Given</strong> {criterion.given}, <strong>when</strong> {criterion.when}, <strong>then</strong> {criterion.thenOutcome}.</p>
                  ))}
                </div>
                <div>
                  <span className="section-kicker">Traceable tests</span>
                  <ul>{story.tests.map((test) => <li key={test.id}><CheckSquare size={14} aria-hidden="true" /><span><strong>{test.id}</strong> {test.label}</span></li>)}</ul>
                </div>
                <div className="requirement-dependencies">
                  <span className="section-kicker">Dependencies</span>
                  <ul>{story.dependencies.map((dependency) => <li key={dependency}>{dependency}</li>)}</ul>
                </div>
                <div className="requirement-card-actions">
                  <button className="story-run" type="button" onClick={() => setRequestedStory(story.id)}><Play size={15} aria-hidden="true" />Run story suite</button>
                  <button className="story-run" type="button" onClick={() => onNavigate(story.evidenceView)}>{story.evidenceLabel}<ExternalLink size={15} aria-hidden="true" /></button>
                </div>
              </div>
            </div>
          </details>
        ))}

        {filteredStories.length === 0 && (
          <div className="requirements-empty-state data-surface" role="status">
            <ClipboardList size={28} aria-hidden="true" />
            <h2>No requirement stories match</h2>
            <p>Adjust the search, rule, test, priority, role, or status filters. The ten-test acceptance suite remains available above.</p>
            <button className="button-quiet" type="button" onClick={resetFilters}><RotateCcw size={15} aria-hidden="true" />Reset filters</button>
          </div>
        )}
      </div>
    </div>
  );
}
