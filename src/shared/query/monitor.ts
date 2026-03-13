import { queryOptions } from "@tanstack/react-query";

import {
  isTauriRuntimeAvailable,
  querySessionDetail,
  queryWorkspaceSessions,
  queryWorkspaceSessionsCached,
} from "@/shared/api";

export const TAURI_RUNTIME_UNAVAILABLE_MESSAGE =
  "Tauri runtime unavailable. Launch the app with `pnpm tauri:dev`.";

export const monitorQueryKeys = {
  workspaceSessionsCached: () => ["monitor", "workspace-sessions", "cached"] as const,
  workspaceSessionsLive: () => ["monitor", "workspace-sessions", "live"] as const,
  workspaceSessions: () => ["monitor", "workspace-sessions"] as const,
  sessionDetail: (sessionId: string | null) =>
    ["monitor", "session-detail", sessionId] as const,
};

function assertTauriRuntimeAvailable() {
  if (!isTauriRuntimeAvailable()) {
    throw new Error(TAURI_RUNTIME_UNAVAILABLE_MESSAGE);
  }
}

export function workspaceSessionsQueryOptions() {
  return queryOptions({
    queryKey: monitorQueryKeys.workspaceSessions(),
    queryFn: async () => {
      assertTauriRuntimeAvailable();

      return queryWorkspaceSessions();
    },
  });
}

export function workspaceSessionsCachedQueryOptions() {
  return queryOptions({
    queryKey: monitorQueryKeys.workspaceSessionsCached(),
    queryFn: async () => {
      assertTauriRuntimeAvailable();

      return queryWorkspaceSessionsCached();
    },
    refetchInterval: 5_000,
    refetchIntervalInBackground: true,
  });
}

export function sessionDetailQueryOptions(sessionId: string) {
  return queryOptions({
    queryKey: monitorQueryKeys.sessionDetail(sessionId),
    queryFn: async () => {
      assertTauriRuntimeAvailable();

      return querySessionDetail({ session_id: sessionId });
    },
    refetchOnMount: true,
  });
}
