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

export function resolveSessionScoreTone(score: number | null) {
  if (score === null) {
    return EMPTY_SCORE_TONE;
  }

  return SCORED_TONES.find((entry) => score >= entry.minScore)?.tone ?? FALLBACK_SCORE_TONE;
}

export function formatScoredAt(value: string | null | undefined) {
  if (!value) {
    return "Not scored yet";
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}
