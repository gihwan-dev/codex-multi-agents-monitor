import { ThreadSwimlanePanel } from "@/features/thread-detail/ui/thread-swimlane-panel";
import { ThreadTimelineEmptyState } from "@/features/thread-detail/ui/thread-timeline-empty-state";
import { ThreadTimelineHeader } from "@/features/thread-detail/ui/thread-timeline-header";
import { ThreadTimelineLoadingState } from "@/features/thread-detail/ui/thread-timeline-loading-state";
import type { ThreadDetail } from "@/shared/types/contracts";

type ThreadTimelineShellProps = {
  threadId: string;
  detail: ThreadDetail | null;
  isLoading: boolean;
};

export function ThreadTimelineShell({
  threadId,
  detail,
  isLoading,
}: ThreadTimelineShellProps) {
  if (isLoading) {
    return <ThreadTimelineLoadingState />;
  }

  if (!detail) {
    return <ThreadTimelineEmptyState threadId={threadId} />;
  }

  return (
    <section className="space-y-4">
      <ThreadTimelineHeader
        status={detail.thread.status}
        title={detail.thread.title}
      />
      <ThreadSwimlanePanel />
    </section>
  );
}
