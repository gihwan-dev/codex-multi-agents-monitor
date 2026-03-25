import type { SkillActivityItem } from "../model/types";
import { freshnessRank } from "./skillFreshnessRank";

export function byName(a: SkillActivityItem, b: SkillActivityItem): number {
  return a.skillName.localeCompare(b.skillName);
}

export function byFreshness(a: SkillActivityItem, b: SkillActivityItem): number {
  const d = freshnessRank(a.tags.freshness) - freshnessRank(b.tags.freshness);
  return d !== 0 ? d : byName(a, b);
}

export function byLastInvocation(a: SkillActivityItem, b: SkillActivityItem): number {
  const d = (a.lastInvocationTs ?? 0) - (b.lastInvocationTs ?? 0);
  return d !== 0 ? d : byName(a, b);
}

export function byCount(a: SkillActivityItem, b: SkillActivityItem): number {
  const d = a.invocationCount - b.invocationCount;
  return d !== 0 ? d : byName(a, b);
}
