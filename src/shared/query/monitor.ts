import { queryOptions, type QueryClient } from "@tanstack/react-query";

import {
  mergeBootstrapSnapshot,
  type WorkspaceSessionsSnapshot,
} from "@/entities/session";
import {
  isTauriRuntimeAvailable,
  querySessionDetail,
  queryWorkspaceSessions,
} from "@/shared/api";

export const TAURI_RUNTIME_UNAVAILABLE_MESSAGE =
  "Tauri runtime unavailable. Launch the app with `pnpm tauri:dev`.";

export const monitorQueryKeys = {
  workspaceSessions: () => ["monitor", "workspace-sessions"] as const,
  sessionDetail: (sessionId: string | null) =>
    ["monitor", "session-detail", sessionId] as const,
};

function assertTauriRuntimeAvailable() {
  if (!isTauriRuntimeAvailable()) {
    throw new Error(TAURI_RUNTIME_UNAVAILABLE_MESSAGE);
  }
}

export function workspaceSessionsQueryOptions(queryClient: QueryClient) {
  const queryKey = monitorQueryKeys.workspaceSessions();

  return queryOptions({
    queryKey,
    queryFn: async () => {
      assertTauriRuntimeAvailable();
      const cachedSnapshotAtStart =
        queryClient.getQueryData<WorkspaceSessionsSnapshot>(queryKey) ?? null;

      const bootstrapSnapshot = await queryWorkspaceSessions();
      if (cachedSnapshotAtStart) {
        return bootstrapSnapshot;
      }

      const liveSnapshot =
        queryClient.getQueryData<WorkspaceSessionsSnapshot>(queryKey) ?? null;

      return mergeBootstrapSnapshot(bootstrapSnapshot, liveSnapshot);
    },
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
