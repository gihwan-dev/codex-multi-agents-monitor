import type { SkillStatus } from "../../../entities/skill";
import { cn } from "../../lib";
import { Badge } from "../primitives/badge";
import { SKILL_STATUS_COLORS, SKILL_STATUS_LABELS } from "./SkillStatusBadge.constants";

interface SkillStatusBadgeProps {
  status: SkillStatus;
  className?: string;
}

export function SkillStatusBadge({ status, className }: SkillStatusBadgeProps) {
  const tone = SKILL_STATUS_COLORS[status];

  return (
    <Badge
      data-slot="skill-status-badge"
      data-status={status}
      variant="outline"
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full border px-2 py-0.5 text-[0.72rem] font-medium",
        className,
      )}
      style={{
        borderColor: `color-mix(in srgb, ${tone} 35%, transparent)`,
        backgroundColor: `color-mix(in srgb, ${tone} 12%, var(--color-surface-raised))`,
        color: tone,
      }}
    >
      <span
        className="inline-block size-1.5 rounded-full"
        style={{ backgroundColor: tone }}
        aria-hidden="true"
      />
      <span>{SKILL_STATUS_LABELS[status]}</span>
    </Badge>
  );
}
