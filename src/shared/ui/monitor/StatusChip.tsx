import type { CSSProperties } from "react";
import { cn } from "../../lib";
import { Badge } from "../primitives/badge";

const STATUS_LABELS = {
  queued: "Queued",
  running: "Running",
  waiting: "Waiting",
  blocked: "Blocked",
  interrupted: "Interrupted",
  done: "Done",
  failed: "Failed",
  cancelled: "Cancelled",
  stale: "Stale",
  disconnected: "Disconnected",
} as const;

const STATUS_COLORS = {
  queued: "var(--color-text-tertiary)",
  running: "var(--color-active)",
  waiting: "var(--color-waiting)",
  blocked: "var(--color-blocked)",
  interrupted: "var(--color-transfer)",
  done: "var(--color-success)",
  failed: "var(--color-failed)",
  cancelled: "var(--color-text-tertiary)",
  stale: "var(--color-stale)",
  disconnected: "var(--color-disconnected)",
} as const;

export type StatusChipStatus = keyof typeof STATUS_LABELS;

interface StatusChipProps {
  status: StatusChipStatus;
  subtle?: boolean;
  className?: string;
}

export function StatusChip({
  status,
  subtle = false,
  className,
}: StatusChipProps) {
  const tone = STATUS_COLORS[status];
  const shellStyle: CSSProperties = subtle
    ? {
        color: "var(--color-text-secondary)",
      }
    : {
        borderColor: `color-mix(in srgb, ${tone} 35%, transparent)`,
        backgroundColor: `color-mix(in srgb, ${tone} 12%, var(--color-surface-raised))`,
        color: "var(--color-text)",
      };

  return (
    <Badge
      data-slot="monitor-status-chip"
      data-status={status}
      data-subtle={subtle ? "true" : "false"}
      variant="outline"
      className={cn(
        "inline-flex w-fit items-center gap-2 rounded-full font-medium",
        subtle
          ? "border-transparent bg-transparent px-0 py-0 text-[0.72rem]"
          : "border px-2.5 py-1 text-[0.8rem]",
        className,
      )}
      style={shellStyle}
    >
      <span
        aria-hidden="true"
        data-slot="monitor-status-glyph"
        data-status={status}
        className={cn(
          "shrink-0 rounded-full",
          subtle ? "size-2" : "size-2.5",
        )}
        style={{ backgroundColor: tone }}
      />
      <span>{STATUS_LABELS[status]}</span>
    </Badge>
  );
}
