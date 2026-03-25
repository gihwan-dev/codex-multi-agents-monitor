export const FRESHNESS_TAGS = ["active", "recent", "stale", "unused"] as const;
export const SOURCE_TAGS = ["cataloged", "unlisted"] as const;

export type FreshnessTag = (typeof FRESHNESS_TAGS)[number];
export type SourceTag = (typeof SOURCE_TAGS)[number];

export interface SkillTags {
  freshness: FreshnessTag;
  source: SourceTag;
}

export const FRESHNESS_THRESHOLDS = {
  activeWithinMs: 7 * 24 * 60 * 60 * 1000,
  recentWithinMs: 30 * 24 * 60 * 60 * 1000,
} as const;

export interface SkillCatalogEntry {
  skillName: string;
  description: string;
  catalogSource: string;
}

export interface SkillInvocationSummary {
  skillName: string;
  traceId: string;
  eventId: string;
  timestamp: number;
  agentName: string;
}

export interface SkillActivityItem {
  skillName: string;
  tags: SkillTags;
  description: string;
  invocationCount: number;
  lastInvocationTs: number | null;
  lastInvocationAgent: string | null;
  recentInvocations: SkillInvocationSummary[];
  catalogSource: string | null;
}
