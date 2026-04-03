interface EvalScoreRowProps {
  label: string;
  scoreLabel: string;
}

export function EvalScoreRow({ label, scoreLabel }: EvalScoreRowProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span>{scoreLabel}</span>
    </div>
  );
}
