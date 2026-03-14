import { formatDuration, type GapSegment } from "../domain";

interface GapChipProps {
  gap: GapSegment;
  expanded: boolean;
  onToggle: (gapId: string) => void;
}

export function GapChip({ gap, expanded, onToggle }: GapChipProps) {
  return (
    <button
      type="button"
      className="gap-chip"
      onClick={() => onToggle(gap.gapId)}
      aria-expanded={expanded}
    >
      {expanded ? "Hide gap" : "Show gap"} · {"//"} {formatDuration(gap.durationMs)} hidden ·{" "}
      {gap.idleLaneCount} lanes idle {"//"}
    </button>
  );
}
