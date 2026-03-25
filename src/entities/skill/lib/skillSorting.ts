import type { FreshnessTag, SkillActivityItem, SourceTag } from "../model/types";
import { byCount, byFreshness, byLastInvocation, byName } from "./skillComparators";

export type SkillSortField = "name" | "freshness" | "lastInvocation" | "invocationCount";
export type SkillSortDirection = "asc" | "desc";
export type SkillFreshnessFilter = FreshnessTag | "all";
export type SkillSourceFilter = SourceTag | "all";

type SkillComparator = (a: SkillActivityItem, b: SkillActivityItem) => number;

const COMPARATORS: Record<SkillSortField, SkillComparator> = {
  name: byName,
  freshness: byFreshness,
  lastInvocation: byLastInvocation,
  invocationCount: byCount,
};

export function sortSkills(items: readonly SkillActivityItem[], field: SkillSortField, dir: SkillSortDirection): SkillActivityItem[] {
  const mul = dir === "asc" ? 1 : -1;
  return [...items].sort((a, b) => COMPARATORS[field](a, b) * mul);
}

export function filterSkillsByFreshness(items: readonly SkillActivityItem[], filter: SkillFreshnessFilter): SkillActivityItem[] {
  return filter === "all" ? [...items] : items.filter((i) => i.tags.freshness === filter);
}

export function filterSkillsBySource(items: readonly SkillActivityItem[], filter: SkillSourceFilter): SkillActivityItem[] {
  return filter === "all" ? [...items] : items.filter((i) => i.tags.source === filter);
}

export function filterSkillsBySearch(items: readonly SkillActivityItem[], query: string): SkillActivityItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...items];
  return items.filter((i) => i.skillName.toLowerCase().includes(q) || i.description.toLowerCase().includes(q));
}
