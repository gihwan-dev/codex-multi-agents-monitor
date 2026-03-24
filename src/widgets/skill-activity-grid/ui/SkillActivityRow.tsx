import type { SkillActivityItem } from "../../../entities/skill";
import { formatRelativeTime } from "../../../shared/lib/format/monitor";
import { SkillStatusBadge } from "../../../shared/ui/monitor/SkillStatusBadge";

interface SkillActivityRowProps {
  item: SkillActivityItem;
  onSkillClick: (item: SkillActivityItem) => void;
}

function formatCount(count: number): string {
  if (count === 0) return "\u2014";
  return `${count} call${count !== 1 ? "s" : ""}`;
}

function formatLastSeen(ts: number | null): string {
  if (ts === null) return "\u2014";
  return `${formatRelativeTime(ts)} ago`;
}

export function SkillActivityRow({ item, onSkillClick }: SkillActivityRowProps) {
  const hasInvocations = item.invocationCount > 0;

  return (
    <button
      type="button"
      disabled={!hasInvocations}
      onClick={() => onSkillClick(item)}
      className="grid w-full grid-cols-[8rem_1fr_6rem_6rem] items-center gap-3 border-b border-white/5 px-4 py-2.5 text-left text-sm transition-colors hover:bg-white/[0.03] disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent"
    >
      <SkillStatusBadge status={item.status} />
      <div className="min-w-0">
        <span className="font-medium text-foreground">{item.skillName}</span>
        {item.description && (
          <span className="ml-2 truncate text-xs text-muted-foreground">
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
    </button>
  );
}
