import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { buildThreadTimelineViewModel } from "@/features/thread-detail/lib/build-thread-timeline-view-model";
import { ThreadSwimlanePanel } from "@/features/thread-detail/ui/thread-swimlane-panel";
import { ThreadTimelineEmptyState } from "@/features/thread-detail/ui/thread-timeline-empty-state";
import { ThreadTimelineHeader } from "@/features/thread-detail/ui/thread-timeline-header";
import { ThreadTimelineLoadingState } from "@/features/thread-detail/ui/thread-timeline-loading-state";
import { getThreadDrilldown } from "@/shared/lib/tauri/commands";
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
  const [selectedLaneId, setSelectedLaneId] = useState<string | null>(null);
  const viewModel = detail ? buildThreadTimelineViewModel(detail) : null;

  const drilldownQuery = useQuery({
    queryKey: ["monitor", "thread_drilldown", threadId, selectedLaneId],
    queryFn: () => getThreadDrilldown(threadId, selectedLaneId ?? ""),
    enabled: Boolean(threadId && detail && selectedLaneId),
    refetchInterval: detail && !detail.thread.archived ? 2_000 : false,
  });

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

  useEffect(() => {
    if (!viewModel) {
      setSelectedLaneId(null);
      return;
    }

    if (
      !selectedLaneId ||
      !viewModel.lanes.some((lane) => lane.id === selectedLaneId)
    ) {
      setSelectedLaneId(viewModel.thread_id);
    }
  }, [selectedLaneId, viewModel]);

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
        onLaneSelect={setSelectedLaneId}
        selectedLaneId={selectedLaneId}
        selectedMarkerId={selectedMarkerId}
        drilldown={drilldownQuery.data ?? null}
        isDrilldownLoading={drilldownQuery.isLoading}
        viewModel={viewModel}
      />
    </section>
  );
}
