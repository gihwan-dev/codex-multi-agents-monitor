import { cn } from "../../../shared/lib";
import { Badge } from "../../../shared/ui/primitives";

interface ScoreBadgeProps {
  score: number | null;
  compact?: boolean;
  showEmptyLabel?: boolean;
}

const EMPTY_SCORE_TONE =
  "border-[color:var(--color-chrome-border)] bg-[var(--color-surface-tint)] text-[var(--color-text-tertiary)]";
const FALLBACK_SCORE_TONE =
  "border-[color:color-mix(in_srgb,var(--color-failed)_30%,transparent)] bg-[color:color-mix(in_srgb,var(--color-failed)_12%,transparent)] text-[var(--color-failed)]";
const SCORED_TONES = [
  {
    minScore: 85,
    tone: "border-[color:color-mix(in_srgb,var(--color-success)_30%,transparent)] bg-[color:color-mix(in_srgb,var(--color-success)_12%,transparent)] text-[var(--color-success)]",
  },
  {
    minScore: 70,
    tone: "border-[color:color-mix(in_srgb,var(--color-active)_30%,transparent)] bg-[color:color-mix(in_srgb,var(--color-active)_12%,transparent)] text-[var(--color-active)]",
  },
  {
    minScore: 50,
    tone: "border-[color:color-mix(in_srgb,var(--color-waiting)_30%,transparent)] bg-[color:color-mix(in_srgb,var(--color-waiting)_12%,transparent)] text-[var(--color-waiting)]",
  },
] as const;

function resolveScoreTone(score: number | null) {
  if (score === null) {
    return EMPTY_SCORE_TONE;
  }

  return SCORED_TONES.find((entry) => score >= entry.minScore)?.tone ?? FALLBACK_SCORE_TONE;
}

export function ScoreBadge({
  score,
  compact = false,
  showEmptyLabel = true,
}: ScoreBadgeProps) {
  if (score === null && !showEmptyLabel) {
    return null;
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        "border px-1.5 py-0.5 font-semibold tabular-nums",
        compact ? "text-[0.62rem]" : "text-[0.7rem]",
        resolveScoreTone(score),
      )}
    >
      {score === null ? "Unscored" : `${score}/100`}
    </Badge>
  );
}
