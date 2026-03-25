import type { FreshnessTag, SourceTag } from "../../../entities/skill";

export const FRESHNESS_LABELS: Record<FreshnessTag, string> = {
  active: "Active",
  recent: "Recent",
  stale: "Stale",
  unused: "Unused",
};

export const FRESHNESS_COLORS: Record<FreshnessTag, string> = {
  active: "var(--color-active)",
  recent: "var(--color-success)",
  stale: "var(--color-stale)",
  unused: "var(--color-text-tertiary)",
};

export const FRESHNESS_DESCRIPTIONS: Record<FreshnessTag, string> = {
  active: "Last 7 days",
  recent: "8–30 days ago",
  stale: "Over 30 days ago",
  unused: "Never invoked",
};

export const SOURCE_LABELS: Record<SourceTag, string> = {
  cataloged: "Cataloged",
  unlisted: "Unlisted",
};

export const SOURCE_COLORS: Record<SourceTag, string> = {
  cataloged: "var(--color-transfer)",
  unlisted: "var(--color-waiting)",
};

export const SOURCE_DESCRIPTIONS: Record<SourceTag, string> = {
  cataloged: "In skills-catalog",
  unlisted: "Not in current catalog",
};
