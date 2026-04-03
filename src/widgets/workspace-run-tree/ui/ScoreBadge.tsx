import { cn } from "../../../shared/lib";
import { Badge } from "../../../shared/ui/primitives";

interface ScoreBadgeProps {
  score: number | null;
  compact?: boolean;
  showEmptyLabel?: boolean;
}

const EMPTY_SCORE_TONE =
  "border-white/10 bg-white/[0.04] text-[var(--color-text-tertiary)]";
const FALLBACK_SCORE_TONE =
  "border-rose-400/30 bg-rose-400/12 text-rose-100";
const SCORED_TONES = [
  {
    minScore: 85,
    tone: "border-emerald-400/30 bg-emerald-400/12 text-emerald-100",
  },
  {
    minScore: 70,
    tone: "border-sky-400/30 bg-sky-400/12 text-sky-100",
  },
  {
    minScore: 50,
    tone: "border-amber-400/30 bg-amber-400/12 text-amber-100",
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
