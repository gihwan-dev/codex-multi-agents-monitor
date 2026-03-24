import { cn } from "../../lib";
import { LoadingCopy } from "./LoadingStateCopy";
import { LoadingProgress } from "./LoadingStateProgress";
import { LoadingSkeletonRows } from "./LoadingStateSkeletonRows";
import { LoadingTargetCard } from "./LoadingStateTargetCard";
import { getAnnouncementProps } from "./loadingStateAnnouncement";

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
