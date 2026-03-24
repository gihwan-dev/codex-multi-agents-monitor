import type { SkillStatus } from "../../../entities/skill";

export const SKILL_STATUS_LABELS: Record<SkillStatus, string> = {
  "active-run": "Active",
  "recently-used": "Recent",
  stale: "Stale",
  "never-seen": "Never seen",
  unlisted: "Unlisted",
};

export const SKILL_STATUS_COLORS: Record<SkillStatus, string> = {
  "active-run": "var(--color-active)",
  "recently-used": "var(--color-success)",
  stale: "var(--color-stale)",
  "never-seen": "var(--color-text-tertiary)",
  unlisted: "var(--color-waiting)",
};
