import { cn } from "../../lib";

interface LoadingProgressProps {
  compact?: boolean;
  phaseLabel: string;
}

export function LoadingProgress({ compact, phaseLabel }: LoadingProgressProps) {
  return (
    <div className="grid gap-2" role="progressbar" aria-label={phaseLabel}>
      <span className={cn("text-[0.7rem] font-medium uppercase tracking-[0.08em] text-[var(--color-text-tertiary)]", compact && "text-[0.66rem]")}>
        {phaseLabel}
      </span>
      <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full w-1/2 rounded-full bg-primary/80 motion-safe:animate-pulse motion-reduce:animate-none" />
      </div>
    </div>
  );
}
