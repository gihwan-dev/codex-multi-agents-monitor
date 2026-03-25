import type { FreshnessTag } from "../model/types";

export function freshnessRank(tag: FreshnessTag): number {
  const order: Record<FreshnessTag, number> = { active: 0, recent: 1, stale: 2, unused: 3 };
  return order[tag];
}
