import { formatDuration } from "../domain";

interface GapChipProps {
  gapId: string;
  label: string;
  durationMs: number;
  expanded: boolean;
  onToggle: (gapId: string) => void;
}

export function GapChip({ gapId, label, durationMs, expanded, onToggle }: GapChipProps) {
  return (
    <button
      type="button"
      className="gap-chip"
      onClick={() => onToggle(gapId)}
      aria-expanded={expanded}
      aria-label={`${expanded ? "Collapse" : "Expand"} gap: ${formatDuration(durationMs)}`}
    >
      <span className="gap-chip__chevron" aria-hidden="true" />
      {expanded ? "Hide" : "Show"} · {label}
    </button>
  );
}
