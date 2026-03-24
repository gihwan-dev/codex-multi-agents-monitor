import { cn } from "../../lib";

interface LoadingTargetCardProps {
  compact?: boolean;
  targetEyebrow?: string;
  targetMeta?: string;
  targetTitle?: string;
}

export function LoadingTargetCard({
  compact,
  targetEyebrow,
  targetMeta,
  targetTitle,
}: LoadingTargetCardProps) {
  if (!targetTitle) {
    return null;
  }

  return (
    <div className="grid gap-1 rounded-[14px] border border-white/8 bg-white/[0.03] px-3 py-3">
      {targetEyebrow ? <span className="text-[0.68rem] font-medium uppercase tracking-[0.08em] text-[var(--color-text-tertiary)]">{targetEyebrow}</span> : null}
      <strong className={cn("truncate text-sm font-semibold text-foreground", compact && "text-[0.82rem]")} title={targetTitle}>
        {targetTitle}
      </strong>
      {targetMeta ? <p className={cn("truncate text-[0.82rem] text-muted-foreground", compact && "text-[0.74rem]")} title={targetMeta}>{targetMeta}</p> : null}
    </div>
  );
}
