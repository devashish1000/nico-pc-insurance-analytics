import { describe, expect, it } from 'vitest';
import { ACCEPTANCE_CASES } from '../src/lib/acceptance';
import { PRIORITIZED_BACKLOG, UAT_READINESS } from '../src/lib/businessAnalysis';
import { DELIVERY_HUB_TABS, defaultDeliveryTab, isDeliveryTab } from '../src/pc/DeliveryHub';
import {
  DEFAULT_REQUIREMENT_FILTERS,
  filterRequirementStories,
  type RequirementFilters,
} from '../src/lib/requirementFilters';
import { STORIES } from '../src/lib/requirements';

const filters = (patch: Partial<RequirementFilters>): RequirementFilters => ({
  ...DEFAULT_REQUIREMENT_FILTERS,
  ...patch,
});

describe('Delivery Hub UI contracts', () => {
  it('exposes the six URL-controllable delivery tabs', () => {
    expect(DELIVERY_HUB_TABS.map((tab) => tab.id)).toEqual([
      'traceability', 'workflow', 'raci', 'governance', 'backlog', 'uat',
    ]);
    expect(defaultDeliveryTab).toBe('traceability');
    expect(DELIVERY_HUB_TABS.every((tab) => isDeliveryTab(tab.id))).toBe(true);
    expect(isDeliveryTab('requirements')).toBe(false);
  });

  it('filters requirement cards by discovery, rule and test evidence', () => {
    expect(filterRequirementStories(STORIES, filters({}))).toHaveLength(5);
    expect(filterRequirementStories(STORIES, filters({ priority: 'Should' })).map((story) => story.id)).toEqual(['US-03']);
    expect(filterRequirementStories(STORIES, filters({ role: 'Underwriter' })).map((story) => story.id)).toEqual(['US-01', 'US-03']);
    expect(filterRequirementStories(STORIES, filters({ status: 'Executable' }))).toHaveLength(5);
    expect(filterRequirementStories(STORIES, filters({ rule: 'loss ratio' })).map((story) => story.id)).toEqual(['US-04']);
    expect(filterRequirementStories(STORIES, filters({ test: 'AT-09' })).map((story) => story.id)).toEqual(['US-05']);
    expect(filterRequirementStories(STORIES, filters({ search: 'vw_loss_ratio_by_lob' })).map((story) => story.id)).toEqual(['US-04']);
  });

  it('never changes the acceptance-suite source when card filters return no stories', () => {
    const noStories = filterRequirementStories(STORIES, filters({ search: 'no-such-story' }));
    expect(noStories).toHaveLength(0);
    expect(ACCEPTANCE_CASES).toHaveLength(10);
    expect(new Set(ACCEPTANCE_CASES.map((test) => test.id)).size).toBe(10);
  });

  it('keeps backlog items visibly candidate and UAT claims explicitly unapproved', () => {
    expect(PRIORITIZED_BACKLOG.every((item) => item.status === 'Candidate')).toBe(true);
    expect(UAT_READINESS.approval).toBe('Not applicable');
    expect(UAT_READINESS.checks.find((check) => check.label === 'NICO stakeholder validation')?.status).toBe('Not performed');
    expect(UAT_READINESS.checks.find((check) => check.label === 'Production readiness assessment')?.status).toBe('Not performed');
  });
});
