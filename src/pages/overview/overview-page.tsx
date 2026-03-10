import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { useThreadUiStore } from "@/entities/thread/model/thread-ui-store";
import { LiveOverviewShell } from "@/features/overview/ui/live-overview-shell";
import { listLiveThreads } from "@/shared/lib/tauri/commands";

export function OverviewPage() {
  const setSelectedThreadId = useThreadUiStore(
    (state) => state.setSelectedThreadId,
  );

  const liveThreadsQuery = useQuery({
    queryKey: ["monitor", "live_threads"],
    queryFn: listLiveThreads,
    refetchInterval: 2_000,
  });

  useEffect(() => {
    setSelectedThreadId(null);
  }, [setSelectedThreadId]);

  return (
    <LiveOverviewShell
      threads={liveThreadsQuery.data ?? []}
      isLoading={liveThreadsQuery.isLoading}
    />
  );
}
