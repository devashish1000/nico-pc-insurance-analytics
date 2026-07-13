import { describe, expect, it } from 'vitest';
import { ACCEPTANCE_CASES } from '../src/lib/acceptance';
import {
  BUSINESS_OBJECTIVES,
  GOVERNANCE_ITEMS,
  RACI_ACTIVITIES,
  RACI_ROLES,
  TRACEABILITY_MATRIX,
  UAT_READINESS,
  WORKFLOW_DISCLAIMER,
  WORKFLOWS,
} from '../src/lib/businessAnalysis';
import { isView } from '../src/lib/navigation';
import { STORIES } from '../src/lib/requirements';

const sorted = (values: string[]) => [...values].sort();

describe('business-analysis delivery contracts', () => {
  it('keeps one RTM record for every requirement story', () => {
    expect(TRACEABILITY_MATRIX).toHaveLength(STORIES.length);
    expect(sorted(TRACEABILITY_MATRIX.map((record) => record.storyId)))
      .toEqual(sorted(STORIES.map((story) => story.id)));
    expect(new Set(TRACEABILITY_MATRIX.map((record) => record.storyId)).size)
      .toBe(TRACEABILITY_MATRIX.length);
  });

  it('covers all ten acceptance cases exactly once', () => {
    const rtmTestIds = TRACEABILITY_MATRIX.flatMap((record) => record.testIds);
    const executableTestIds = ACCEPTANCE_CASES.map((test) => test.id);

    expect(executableTestIds).toHaveLength(10);
    expect(rtmTestIds).toHaveLength(10);
    expect(new Set(rtmTestIds).size).toBe(10);
    expect(sorted(rtmTestIds)).toEqual(sorted(executableTestIds));
  });

  it('uses valid evidence destinations and complete objective coverage', () => {
    expect(TRACEABILITY_MATRIX.every((record) => isView(record.evidenceView))).toBe(true);

    const objectiveStoryIds = BUSINESS_OBJECTIVES.flatMap((objective) => objective.storyIds);
    expect(sorted(objectiveStoryIds)).toEqual(sorted(STORIES.map((story) => story.id)));
    expect(new Set(objectiveStoryIds).size).toBe(STORIES.length);

    const objectiveIds = new Set(BUSINESS_OBJECTIVES.map((objective) => objective.id));
    expect(TRACEABILITY_MATRIX.every((record) => objectiveIds.has(record.objectiveId))).toBe(true);
  });

  it('assigns exactly one accountable role and at least one responsible role per RACI activity', () => {
    const roleIds = sorted(RACI_ROLES.map((role) => role.id));

    for (const activity of RACI_ACTIVITIES) {
      expect(sorted(Object.keys(activity.assignments))).toEqual(roleIds);
      expect(Object.values(activity.assignments).filter((code) => code === 'A')).toHaveLength(1);
      expect(Object.values(activity.assignments).filter((code) => code === 'R').length).toBeGreaterThanOrEqual(1);
    }
  });

  it('contains every governance register category', () => {
    const kinds = new Set(GOVERNANCE_ITEMS.map((item) => item.kind));
    expect(kinds).toEqual(new Set(['Decision', 'Assumption', 'Dependency', 'Open question']));
  });

  it('separates illustrative workflow risk from demonstrated app behavior', () => {
    expect(WORKFLOWS.map((workflow) => workflow.id)).toEqual(['as-is', 'to-be']);
    expect(WORKFLOW_DISCLAIMER).toContain('not a description of NICO operations');
    expect(WORKFLOWS.find((workflow) => workflow.id === 'as-is')?.steps.every((step) => !step.evidenceView)).toBe(true);
    expect(WORKFLOWS.find((workflow) => workflow.id === 'to-be')?.steps.every((step) => isView(step.evidenceView ?? ''))).toBe(true);
  });

  it('does not imply NICO or production UAT approval', () => {
    const nicoValidation = UAT_READINESS.checks.find((check) => check.label === 'NICO stakeholder validation');
    const productionReadiness = UAT_READINESS.checks.find((check) => check.label === 'Production readiness assessment');
    const serialized = JSON.stringify(UAT_READINESS).toLowerCase();

    expect(UAT_READINESS.reviewer).toBe('Author self-review only');
    expect(UAT_READINESS.approval).toBe('Not applicable');
    expect(UAT_READINESS.decision).toContain('after an on-demand acceptance run');
    expect(nicoValidation?.status).toBe('Not performed');
    expect(productionReadiness?.status).toBe('Not performed');
    expect(UAT_READINESS.disclaimer).toContain('No NICO stakeholder reviewed or approved');
    expect(UAT_READINESS.disclaimer).toContain('not production UAT');
    expect(serialized).not.toContain('nico approved');
    expect(serialized).not.toContain('production approved');
  });
});
