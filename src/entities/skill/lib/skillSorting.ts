import type { FreshnessTag, SkillActivityItem, SourceTag } from "../model/types";

export type SkillSortField = "name" | "freshness" | "lastInvocation" | "invocationCount";
export type SkillSortDirection = "asc" | "desc";
export type SkillFreshnessFilter = FreshnessTag | "all";
export type SkillSourceFilter = SourceTag | "all";

const FRESHNESS_ORDER: Record<FreshnessTag, number> = {
  active: 0,
  recent: 1,
  stale: 2,
  unused: 3,
};

function compareByName(a: SkillActivityItem, b: SkillActivityItem): number {
  return a.skillName.localeCompare(b.skillName);
}

function compareByFreshness(a: SkillActivityItem, b: SkillActivityItem): number {
  const diff = FRESHNESS_ORDER[a.tags.freshness] - FRESHNESS_ORDER[b.tags.freshness];
  return diff !== 0 ? diff : compareByName(a, b);
}

function compareByLastInvocation(a: SkillActivityItem, b: SkillActivityItem): number {
  const aTs = a.lastInvocationTs ?? 0;
  const bTs = b.lastInvocationTs ?? 0;
  const diff = aTs - bTs;
  return diff !== 0 ? diff : compareByName(a, b);
}

function compareByInvocationCount(a: SkillActivityItem, b: SkillActivityItem): number {
  const diff = a.invocationCount - b.invocationCount;
  return diff !== 0 ? diff : compareByName(a, b);
}

const COMPARATORS: Record<SkillSortField, (a: SkillActivityItem, b: SkillActivityItem) => number> = {
  name: compareByName,
  freshness: compareByFreshness,
  lastInvocation: compareByLastInvocation,
  invocationCount: compareByInvocationCount,
};

export function sortSkills(
  items: readonly SkillActivityItem[],
  field: SkillSortField,
  direction: SkillSortDirection,
): SkillActivityItem[] {
  const comparator = COMPARATORS[field];
  const multiplier = direction === "asc" ? 1 : -1;
  return [...items].sort((a, b) => comparator(a, b) * multiplier);
}

export function filterSkillsByFreshness(
  items: readonly SkillActivityItem[],
  filter: SkillFreshnessFilter,
): SkillActivityItem[] {
  if (filter === "all") return [...items];
  return items.filter((item) => item.tags.freshness === filter);
}

export function filterSkillsBySource(
  items: readonly SkillActivityItem[],
  filter: SkillSourceFilter,
): SkillActivityItem[] {
  if (filter === "all") return [...items];
  return items.filter((item) => item.tags.source === filter);
}

export function filterSkillsBySearch(
  items: readonly SkillActivityItem[],
  query: string,
): SkillActivityItem[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [...items];
  return items.filter(
    (item) =>
      item.skillName.toLowerCase().includes(trimmed) ||
      item.description.toLowerCase().includes(trimmed),
  );
}
