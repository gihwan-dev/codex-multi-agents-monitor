import { cn } from "../../lib";

export interface MonitorLoadingPresentation {
  title: string;
  message: string;
  phaseLabel: string;
  targetEyebrow?: string;
  targetTitle?: string;
  targetMeta?: string;
}

interface LoadingStateBlockProps extends MonitorLoadingPresentation {
  announce?: boolean;
  className?: string;
  compact?: boolean;
  skeletonRows?: number;
}

interface LoadingTargetCardProps {
  compact?: boolean;
  targetEyebrow?: string;
  targetMeta?: string;
  targetTitle?: string;
}

interface LoadingCopyProps {
  compact?: boolean;
  message: string;
  title: string;
}

interface LoadingProgressProps {
  compact?: boolean;
  phaseLabel: string;
}

interface LoadingSkeletonRowsProps {
  skeletonRows?: number;
  title: string;
}

const SKELETON_WIDTHS = [
  "w-[92%]",
  "w-[76%]",
  "w-[84%]",
];

function buildSkeletonRowKey(title: string, rowNumber: number) {
  return `${title}-row-${rowNumber}`;
}

function resolveSkeletonWidthClass(index: number) {
  return SKELETON_WIDTHS[index % SKELETON_WIDTHS.length] ?? SKELETON_WIDTHS[0];
}

function SkeletonRow({ index }: { index: number }) {
  const widthClass = resolveSkeletonWidthClass(index);
  return (
    <div
      className={cn(
        "h-8 rounded-md bg-white/[0.04] motion-safe:animate-pulse motion-reduce:animate-none",
        widthClass,
      )}
    />
  );
}

function renderSkeletonRows(title: string, skeletonRows: number) {
  return Array.from({ length: skeletonRows }, (_, index) => (
    <SkeletonRow key={buildSkeletonRowKey(title, index + 1)} index={index} />
  ));
}

function LoadingTargetCard({
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
      {targetEyebrow ? (
        <span className="text-[0.68rem] font-medium uppercase tracking-[0.08em] text-[var(--color-text-tertiary)]">
          {targetEyebrow}
        </span>
      ) : null}
      <strong
        className={cn(
          "truncate text-sm font-semibold text-foreground",
          compact && "text-[0.82rem]",
        )}
        title={targetTitle}
      >
        {targetTitle}
      </strong>
      {targetMeta ? (
        <p
          className={cn(
            "truncate text-[0.82rem] text-muted-foreground",
            compact && "text-[0.74rem]",
          )}
          title={targetMeta}
        >
          {targetMeta}
        </p>
      ) : null}
    </div>
  );
}

function LoadingCopy({
  compact,
  message,
  title,
}: LoadingCopyProps) {
  return (
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
  );
}

function LoadingProgress({
  compact,
  phaseLabel,
}: LoadingProgressProps) {
  return (
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
  );
}

function LoadingSkeletonRows({
  skeletonRows,
  title,
}: LoadingSkeletonRowsProps) {
  const rowCount = skeletonRows ?? 0;
  if (rowCount <= 0) {
    return null;
  }

  return <div className="grid gap-2" aria-hidden="true">{renderSkeletonRows(title, rowCount)}</div>;
}

function getAnnouncementProps(announce: boolean) {
  if (!announce) {
    return {};
  }

  return {
    role: "status" as const,
    "aria-live": "polite" as const,
    "aria-atomic": "true" as const,
  };
}

export function LoadingStateBlock({
  title,
  message,
  phaseLabel,
  targetEyebrow,
  targetTitle,
  targetMeta,
  announce = false,
  className,
  compact = false,
  skeletonRows = 0,
}: LoadingStateBlockProps) {
  const announcementProps = getAnnouncementProps(announce);

  return (
    <div
      className={cn("grid gap-3", compact && "gap-2", className)}
      {...announcementProps}
    >
      <LoadingTargetCard
        compact={compact}
        targetEyebrow={targetEyebrow}
        targetMeta={targetMeta}
        targetTitle={targetTitle}
      />
      <LoadingCopy compact={compact} message={message} title={title} />
      <LoadingProgress compact={compact} phaseLabel={phaseLabel} />
      <LoadingSkeletonRows skeletonRows={skeletonRows} title={title} />
    </div>
  );
}
