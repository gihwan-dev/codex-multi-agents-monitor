import type { SkillActivityItem } from "../../../entities/skill";
import { formatRelativeTime } from "../../../shared/lib/format/monitor";
import { SkillTagBadges } from "../../../shared/ui/monitor/SkillStatusBadge";

interface SkillActivityRowProps {
  item: SkillActivityItem;
}

function formatCount(count: number): string {
  if (count === 0) return "\u2014";
  return `${count} call${count !== 1 ? "s" : ""}`;
}

function formatLastSeen(ts: number | null): string {
  if (ts === null) return "\u2014";
  return `${formatRelativeTime(ts)} ago`;
}

export function SkillActivityRow({ item }: SkillActivityRowProps) {
  return (
    <div
      data-slot="skill-activity-row"
      className="grid grid-cols-[10rem_1fr_6rem_6rem] items-center gap-3 border-b border-white/5 px-4 py-2.5 text-left text-sm"
    >
      <SkillTagBadges tags={item.tags} />
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="shrink-0 font-medium text-foreground">{item.skillName}</span>
        {item.description && (
          <span
            className="truncate text-xs text-muted-foreground"
            title={item.description}
          >
            {item.description}
          </span>
        )}
      </div>
      <span className="text-right font-mono text-xs tabular-nums text-muted-foreground">
        {formatCount(item.invocationCount)}
      </span>
      <span className="text-right font-mono text-xs tabular-nums text-muted-foreground">
        {formatLastSeen(item.lastInvocationTs)}
      </span>
    </div>
  );
}
