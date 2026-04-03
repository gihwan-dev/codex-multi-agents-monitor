interface EvalScoreBarProps {
  value: number | null;
  tone: "baseline" | "candidate";
}

export function EvalScoreBar({ value, tone }: EvalScoreBarProps) {
  const width = value === null ? "0%" : `${Math.max(0, value)}%`;
  const barClassName =
    tone === "candidate"
      ? "bg-[color:color-mix(in_srgb,var(--color-active)_75%,white_5%)]"
      : "bg-[color:color-mix(in_srgb,var(--color-muted)_45%,white_18%)]";

  return (
    <div className="grid gap-1">
      <span className="text-[0.68rem] uppercase tracking-[0.08em] text-muted-foreground">
        {tone}
      </span>
      <div
        className="h-2 overflow-hidden rounded-full bg-white/8"
        aria-label={`Score: ${value ?? "not scored"}`}
        role="img"
      >
        <div className={`h-full rounded-full ${barClassName}`} style={{ width }} />
      </div>
    </div>
  );
}
