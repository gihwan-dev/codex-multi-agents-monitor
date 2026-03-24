import type { SkillActivityItem, SkillStatus } from "../model/types";

export type SkillSortField = "name" | "status" | "lastInvocation" | "invocationCount";
export type SkillSortDirection = "asc" | "desc";
export type SkillStatusFilter = SkillStatus | "all";

const STATUS_ORDER: Record<SkillStatus, number> = {
  "active-run": 0,
  "recently-used": 1,
  unlisted: 2,
  stale: 3,
  "never-seen": 4,
};

function compareByName(a: SkillActivityItem, b: SkillActivityItem): number {
  return a.skillName.localeCompare(b.skillName);
}

function compareByStatus(a: SkillActivityItem, b: SkillActivityItem): number {
  const diff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
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
  status: compareByStatus,
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

export function filterSkillsByStatus(
  items: readonly SkillActivityItem[],
  filter: SkillStatusFilter,
): SkillActivityItem[] {
  if (filter === "all") return [...items];
  return items.filter((item) => item.status === filter);
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
