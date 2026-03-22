import { cn, formatDuration } from "../../lib";

interface GapChipProps {
  label: string;
  durationMs: number;
}

export function GapChip({ label, durationMs }: GapChipProps) {
  return (
    <div
      role="note"
      data-slot="monitor-gap-chip"
      className={cn(
        "inline-flex h-8 items-center rounded-full border border-dashed border-white/16 bg-white/[0.08] px-3",
        "font-mono text-[0.72rem] font-medium text-muted-foreground",
      )}
      aria-label={`Idle gap: ${formatDuration(durationMs)}`}
    >
      <span>{label}</span>
    </div>
  );
}
