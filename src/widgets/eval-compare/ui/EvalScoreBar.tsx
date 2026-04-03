interface EvalScoreBarProps {
  value: number | null;
  tone: "baseline" | "candidate";
}

export function EvalScoreBar({ value, tone }: EvalScoreBarProps) {
  const hasValue = value !== null;
  const resolvedValue = hasValue ? value : 0;
  const width = `${Math.max(0, resolvedValue)}%`;
  const ariaValueNow = hasValue ? resolvedValue : undefined;
  const barClassName =
    tone === "candidate"
      ? "bg-[color:color-mix(in_srgb,var(--color-active)_75%,white_5%)]"
      : "bg-[color:color-mix(in_srgb,var(--color-muted)_45%,white_18%)]";

  return (
    <div className="grid gap-1">
      <span className="text-[0.68rem] uppercase tracking-[0.08em] text-muted-foreground">
        {tone}
      </span>
      <div className="relative h-2 overflow-hidden rounded-full bg-white/8">
        <meter
          className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
          aria-label={`${tone} score`}
          aria-valuenow={ariaValueNow}
          aria-valuemin={0}
          aria-valuemax={100}
          max={100}
          min={0}
          value={resolvedValue}
        >
          {resolvedValue}
        </meter>
        <div className={`h-full rounded-full ${barClassName}`} style={{ width }} />
      </div>
    </div>
  );
}
