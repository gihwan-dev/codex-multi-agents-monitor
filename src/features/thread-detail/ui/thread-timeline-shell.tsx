import { useEffect, useState } from "react";

import { buildThreadTimelineViewModel } from "@/features/thread-detail/lib/build-thread-timeline-view-model";
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
  const [hoveredMarkerId, setHoveredMarkerId] = useState<string | null>(null);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const viewModel = detail ? buildThreadTimelineViewModel(detail) : null;

  useEffect(() => {
    if (
      selectedMarkerId &&
      !viewModel?.markers.some((marker) => marker.id === selectedMarkerId)
    ) {
      setSelectedMarkerId(null);
    }
  }, [selectedMarkerId, viewModel]);

  useEffect(() => {
    if (
      hoveredMarkerId &&
      !viewModel?.markers.some((marker) => marker.id === hoveredMarkerId)
    ) {
      setHoveredMarkerId(null);
    }
  }, [hoveredMarkerId, viewModel]);

  if (isLoading) {
    return <ThreadTimelineLoadingState />;
  }

  if (!detail) {
    return <ThreadTimelineEmptyState threadId={threadId} />;
  }

  if (!viewModel) {
    return <ThreadTimelineEmptyState threadId={threadId} />;
  }

  const activeMarker =
    viewModel?.markers.find((marker) => marker.id === hoveredMarkerId) ??
    viewModel?.markers.find((marker) => marker.id === selectedMarkerId) ??
    (viewModel ? viewModel.markers[viewModel.markers.length - 1] : null) ??
    null;

  return (
    <section className="space-y-4">
      <ThreadTimelineHeader
        status={detail.thread.status}
        title={detail.thread.title}
      />
      <ThreadSwimlanePanel
        activeMarker={activeMarker}
        onMarkerHover={setHoveredMarkerId}
        onMarkerSelect={(markerId) => {
          setSelectedMarkerId((current) =>
            current === markerId ? null : markerId,
          );
        }}
        selectedMarkerId={selectedMarkerId}
        viewModel={viewModel}
      />
    </section>
  );
}
