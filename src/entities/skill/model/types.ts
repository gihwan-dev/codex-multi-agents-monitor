export const SKILL_STATUSES = [
  "active-run",
  "recently-used",
  "stale",
  "never-seen",
  "unlisted",
] as const;

export type SkillStatus = (typeof SKILL_STATUSES)[number];

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
  status: SkillStatus;
  description: string;
  invocationCount: number;
  currentRunInvocations: number;
  lastInvocationTs: number | null;
  lastInvocationAgent: string | null;
  recentInvocations: SkillInvocationSummary[];
  catalogSource: string | null;
}
