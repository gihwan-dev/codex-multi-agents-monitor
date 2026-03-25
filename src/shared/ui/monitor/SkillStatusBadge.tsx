import type { SkillTags } from "../../../entities/skill";
import { cn } from "../../lib";
import { Badge } from "../primitives/badge";
import {
  FRESHNESS_COLORS,
  FRESHNESS_DESCRIPTIONS,
  FRESHNESS_LABELS,
  SOURCE_COLORS,
  SOURCE_DESCRIPTIONS,
  SOURCE_LABELS,
} from "./SkillStatusBadge.constants";

interface TagBadgeProps {
  label: string;
  tone: string;
  tooltip: string;
  className?: string;
}

function TagBadge({ label, tone, tooltip, className }: TagBadgeProps) {
  return (
    <Badge
      variant="outline"
      title={tooltip}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0 text-[0.65rem] font-medium leading-5",
        className,
      )}
      style={{
        borderColor: `color-mix(in srgb, ${tone} 35%, transparent)`,
        backgroundColor: `color-mix(in srgb, ${tone} 10%, var(--color-surface-raised))`,
        color: tone,
      }}
    >
      <span className="inline-block size-1.5 rounded-full" style={{ backgroundColor: tone }} aria-hidden="true" />
      {label}
    </Badge>
  );
}

interface SkillTagBadgesProps {
  tags: SkillTags;
  className?: string;
}

export function SkillTagBadges({ tags, className }: SkillTagBadgesProps) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <TagBadge
        label={FRESHNESS_LABELS[tags.freshness]}
        tone={FRESHNESS_COLORS[tags.freshness]}
        tooltip={FRESHNESS_DESCRIPTIONS[tags.freshness]}
      />
      {tags.source === "unlisted" && (
        <TagBadge
          label={SOURCE_LABELS[tags.source]}
          tone={SOURCE_COLORS[tags.source]}
          tooltip={SOURCE_DESCRIPTIONS[tags.source]}
        />
      )}
    </div>
  );
}
