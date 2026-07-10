import { CheckSquare, ClipboardList, Play } from 'lucide-react';
import { useState } from 'react';
import AcceptanceRunner from '../components/AcceptanceRunner';
import type { View } from '../lib/navigation';
import { STORIES } from '../lib/requirements';
import { Badge, Card, SectionTitle } from './ui';

const priorityTone = { Must: 'red', Should: 'amber', Could: 'slate' } as const;

export default function Requirements({ onNavigate }: { onNavigate: (view: View, testId?: string) => void }) {
  const [requestedStory, setRequestedStory] = useState<string>();
  return (
    <div>
      <SectionTitle
        title="Requirements & Acceptance Criteria"
        subtitle="INVEST user stories with executable Given/When/Then evidence, MoSCoW priority, and traceability into the rating engine and warehouse."
        icon={<ClipboardList size={20} />}
      />

      <AcceptanceRunner onNavigate={onNavigate} requestedStory={requestedStory} onStoryHandled={() => setRequestedStory(undefined)} />

      <div className="requirement-summary">
        <div><span>User stories</span><strong>{STORIES.length}</strong></div>
        <div><span>Acceptance criteria</span><strong>{STORIES.reduce((count, story) => count + story.criteria.length, 0)}</strong></div>
        <div><span>Executable tests</span><strong>{STORIES.reduce((count, story) => count + story.tests.length, 0)}</strong></div>
      </div>

      <div className="requirements-list">
        {STORIES.map((story) => (
          <Card key={story.id} className="requirement-card">
            <div className="requirement-title">
              <span className="story-id">{story.id}</span>
              <Badge tone={priorityTone[story.priority]}>{story.priority}</Badge>
              <p>As a <strong>{story.role}</strong>, I want to <strong>{story.want}</strong>, so that {story.soThat}.</p>
            </div>
            <div className="requirement-grid">
              <div>
                <span className="section-kicker">Given / When / Then</span>
                {story.criteria.map((criterion) => (
                  <p key={criterion.given}><strong>Given</strong> {criterion.given}, <strong>when</strong> {criterion.when}, <strong>then</strong> {criterion.thenOutcome}.</p>
                ))}
              </div>
              <div>
                <span className="section-kicker">Traceable tests</span>
                <ul>{story.tests.map((test) => <li key={test.id}><CheckSquare size={14} /><span><strong>{test.id}</strong> {test.label}</span></li>)}</ul>
              </div>
              <button className="story-run" onClick={() => setRequestedStory(story.id)}><Play size={15} /> Run story suite</button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
