import { cn } from "../../lib";

export interface MonitorLoadingPresentation {
  title: string;
  message: string;
  phaseLabel: string;
}

interface LoadingStateBlockProps extends MonitorLoadingPresentation {
  announce?: boolean;
  className?: string;
  compact?: boolean;
  skeletonRows?: number;
}

const SKELETON_WIDTHS = [
  "w-[92%]",
  "w-[76%]",
  "w-[84%]",
];

export function LoadingStateBlock({
  title,
  message,
  phaseLabel,
  announce = false,
  className,
  compact = false,
  skeletonRows = 0,
}: LoadingStateBlockProps) {
  const skeletonBlocks = [];
  for (let rowNumber = 1; rowNumber <= skeletonRows; rowNumber += 1) {
    const widthClass = SKELETON_WIDTHS[(rowNumber - 1) % SKELETON_WIDTHS.length] ?? SKELETON_WIDTHS[0];
    skeletonBlocks.push(
      <div
        key={`${title}-row-${rowNumber}`}
        className={cn(
          "h-8 rounded-md bg-white/[0.04] motion-safe:animate-pulse motion-reduce:animate-none",
          widthClass,
        )}
      />,
    );
  }

  return (
    <div
      className={cn("grid gap-3", compact && "gap-2", className)}
      role={announce ? "status" : undefined}
      aria-live={announce ? "polite" : undefined}
      aria-atomic={announce ? "true" : undefined}
    >
      <div className="grid gap-1">
        <h3
          className={cn(
            "text-sm font-semibold tracking-[0.01em] text-foreground",
            compact && "text-[0.82rem]",
          )}
        >
          {title}
        </h3>
        <p
          className={cn(
            "text-sm leading-6 text-muted-foreground",
            compact && "text-[0.76rem] leading-5",
          )}
        >
          {message}
        </p>
      </div>

      <div className="grid gap-2">
        <span
          className={cn(
            "text-[0.7rem] font-medium tracking-[0.08em] text-[var(--color-text-tertiary)] uppercase",
            compact && "text-[0.66rem]",
          )}
        >
          {phaseLabel}
        </span>
        <div
          aria-hidden="true"
          className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]"
        >
          <div className="h-full w-1/2 rounded-full bg-primary/80 motion-safe:animate-pulse motion-reduce:animate-none" />
        </div>
      </div>

      {skeletonRows > 0 ? (
        <div className="grid gap-2" aria-hidden="true">{skeletonBlocks}</div>
      ) : null}
    </div>
  );
}
