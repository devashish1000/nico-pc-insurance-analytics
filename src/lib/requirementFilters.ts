import type { RequirementPriority, RequirementStatus, RequirementStory } from './requirements';

export type RequirementFilterValue<T extends string> = 'All' | T;

export type RequirementFilters = {
  search: string;
  priority: RequirementFilterValue<RequirementPriority>;
  role: string;
  status: RequirementFilterValue<RequirementStatus>;
  rule: string;
  test: string;
};

export const DEFAULT_REQUIREMENT_FILTERS: RequirementFilters = {
  search: '',
  priority: 'All',
  role: 'All',
  status: 'All',
  rule: '',
  test: '',
};

const normalized = (value: string) => value.trim().toLocaleLowerCase();
const contains = (value: string | undefined, query: string) => !query || normalized(value ?? '').includes(query);

export function requirementRoles(stories: RequirementStory[]): string[] {
  return [...new Set(stories.map((story) => story.role))].sort((left, right) => left.localeCompare(right));
}

export function requirementStatuses(stories: RequirementStory[]): RequirementStatus[] {
  return [...new Set(stories.map((story) => story.status))].sort((left, right) => left.localeCompare(right));
}

export function filterRequirementStories(
  stories: RequirementStory[],
  filters: RequirementFilters,
): RequirementStory[] {
  const search = normalized(filters.search);
  const rule = normalized(filters.rule);
  const test = normalized(filters.test);

  return stories.filter((story) => {
    if (filters.priority !== 'All' && story.priority !== filters.priority) return false;
    if (filters.role !== 'All' && story.role !== filters.role) return false;
    if (filters.status !== 'All' && story.status !== filters.status) return false;

    const searchable = [
      story.id,
      story.title,
      story.epicId,
      story.objectiveId,
      story.role,
      story.ownerRole,
      story.want,
      story.soThat,
      story.businessRule,
      story.dataRule ?? '',
      ...story.stakeholderRoles,
      ...story.sourceArtifacts,
      ...story.tests.flatMap((candidate) => [candidate.id, candidate.label]),
    ].join(' ');

    const rulesMatch = contains(story.businessRule, rule) || contains(story.dataRule, rule);
    const testsMatch = !test || story.tests.some((candidate) => (
      contains(candidate.id, test) || contains(candidate.label, test)
    ));

    return contains(searchable, search) && rulesMatch && testsMatch;
  });
}
