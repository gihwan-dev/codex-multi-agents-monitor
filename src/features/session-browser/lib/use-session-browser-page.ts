import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";

import { useThreadUiStore } from "@/entities/thread/model/thread-ui-store";
import { listSessions } from "@/shared/lib/tauri/commands";
import type { SessionScope } from "@/shared/types/contracts";

export function useSessionBrowserPage(scope: SessionScope) {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const setSelectedSessionId = useThreadUiStore(
    (state) => state.setSelectedSessionId,
  );
  const activeWorkspace = searchParams.get("workspace");

  const sessionListQuery = useQuery({
    queryKey: ["monitor", "session_list", scope, activeWorkspace],
    queryFn: () =>
      listSessions(scope, {
        workspace: activeWorkspace,
      }),
    refetchInterval: scope === "live" ? 2_000 : false,
  });

  const selectedSession =
    sessionListQuery.data?.sessions.find(
      (session) => session.session_id === sessionId,
    ) ?? null;

  useEffect(() => {
    setSelectedSessionId(sessionId ?? null);
    return () => setSelectedSessionId(null);
  }, [sessionId, setSelectedSessionId]);

  return {
    activeWorkspace,
    sessionId,
    sessionListQuery,
    selectedSession,
    workspaces: sessionListQuery.data?.workspaces ?? [],
    selectWorkspace: (workspace: string | null) =>
      setSearchParams(workspace ? { workspace } : {}),
  };
}
