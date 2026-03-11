import { useQuery } from "@tanstack/react-query";
import { Navigate, useParams } from "react-router-dom";

import { getSessionFlow } from "@/shared/lib/tauri/commands";

export function LegacyThreadRedirectPage() {
  const { threadId } = useParams<{ threadId: string }>();
  const flowQuery = useQuery({
    queryKey: ["monitor", "legacy_thread_redirect", threadId],
    queryFn: () => getSessionFlow(threadId ?? ""),
    enabled: Boolean(threadId),
  });

  if (!threadId) {
    return <Navigate to="/live" replace />;
  }

  if (flowQuery.isLoading) {
    return (
      <section className="flex min-h-[320px] items-center justify-center text-sm text-[hsl(var(--muted))]">
        legacy thread route를 session route로 정리하는 중입니다...
      </section>
    );
  }

  if (!flowQuery.data) {
    return <Navigate to="/live" replace />;
  }

  return (
    <Navigate
      replace
      to={
        flowQuery.data.session.archived
          ? `/archive/${threadId}`
          : `/live/${threadId}`
      }
    />
  );
}
