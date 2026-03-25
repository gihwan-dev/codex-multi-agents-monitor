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

function byName(a: SkillActivityItem, b: SkillActivityItem): number {
  return a.skillName.localeCompare(b.skillName);
}

function byFreshness(a: SkillActivityItem, b: SkillActivityItem): number {
  const diff = FRESHNESS_ORDER[a.tags.freshness] - FRESHNESS_ORDER[b.tags.freshness];
  return diff !== 0 ? diff : byName(a, b);
}

function byLastInvocation(a: SkillActivityItem, b: SkillActivityItem): number {
  const diff = (a.lastInvocationTs ?? 0) - (b.lastInvocationTs ?? 0);
  return diff !== 0 ? diff : byName(a, b);
}

function byCount(a: SkillActivityItem, b: SkillActivityItem): number {
  const diff = a.invocationCount - b.invocationCount;
  return diff !== 0 ? diff : byName(a, b);
}

const COMPARATORS: Record<SkillSortField, (a: SkillActivityItem, b: SkillActivityItem) => number> = {
  name: byName,
  freshness: byFreshness,
  lastInvocation: byLastInvocation,
  invocationCount: byCount,
};

export function sortSkills(
  items: readonly SkillActivityItem[],
  field: SkillSortField,
  direction: SkillSortDirection,
): SkillActivityItem[] {
  const cmp = COMPARATORS[field];
  const m = direction === "asc" ? 1 : -1;
  return [...items].sort((a, b) => cmp(a, b) * m);
}

export function filterSkillsByFreshness(
  items: readonly SkillActivityItem[],
  filter: SkillFreshnessFilter,
): SkillActivityItem[] {
  if (filter === "all") return [...items];
  return items.filter((i) => i.tags.freshness === filter);
}

export function filterSkillsBySource(
  items: readonly SkillActivityItem[],
  filter: SkillSourceFilter,
): SkillActivityItem[] {
  if (filter === "all") return [...items];
  return items.filter((i) => i.tags.source === filter);
}

export function filterSkillsBySearch(
  items: readonly SkillActivityItem[],
  query: string,
): SkillActivityItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...items];
  return items.filter(
    (i) => i.skillName.toLowerCase().includes(q) || i.description.toLowerCase().includes(q),
  );
}
