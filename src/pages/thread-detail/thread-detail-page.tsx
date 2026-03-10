import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useParams } from "react-router-dom";

import { useThreadUiStore } from "@/entities/thread/model/thread-ui-store";
import { ThreadTimelineShell } from "@/features/thread-detail/ui/thread-timeline-shell";
import { getThreadDetail } from "@/shared/lib/tauri/commands";

export function ThreadDetailPage() {
  const params = useParams<{ threadId: string }>();
  const threadId = params.threadId ?? "";
  const setSelectedThreadId = useThreadUiStore(
    (state) => state.setSelectedThreadId,
  );

  const detailQuery = useQuery({
    queryKey: ["monitor", "thread_detail", threadId],
    queryFn: () => getThreadDetail(threadId),
    enabled: Boolean(threadId),
    refetchInterval: (query) =>
      query.state.data?.thread.status === "inflight" ? 2_000 : false,
  });

  useEffect(() => {
    setSelectedThreadId(threadId || null);
    return () => setSelectedThreadId(null);
  }, [setSelectedThreadId, threadId]);

  return (
    <ThreadTimelineShell
      threadId={threadId}
      detail={detailQuery.data ?? null}
      isLoading={detailQuery.isLoading}
    />
  );
}
