import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import {
  compareRefreshMarkers,
  mergeBootstrapSnapshot,
  pruneLiveSnapshot,
  type WorkspaceSessionsSnapshot,
} from "@/entities/session";
import {
  monitorQueryKeys,
  workspaceSessionsCachedQueryOptions,
  workspaceSessionsQueryOptions,
} from "@/shared/query";

function selectNewestSnapshot(
  left: WorkspaceSessionsSnapshot | null | undefined,
  right: WorkspaceSessionsSnapshot | null | undefined,
) {
  if (!left) {
    return right ?? null;
  }
  if (!right) {
    return left;
  }

  return compareRefreshMarkers(left.refreshed_at, right.refreshed_at) >= 0 ? left : right;
}

export function useWorkspaceSessionsQuery(enabled = true) {
  const queryClient = useQueryClient();
  const cachedQuery = useQuery({
    ...workspaceSessionsCachedQueryOptions(),
    enabled,
  });
  const liveQuery = useQuery({
    enabled: false,
    initialData: null as WorkspaceSessionsSnapshot | null,
    queryKey: monitorQueryKeys.workspaceSessionsLive(),
    queryFn: async () => null,
  });
  const query = useQuery({
    ...workspaceSessionsQueryOptions(),
    enabled: enabled && !cachedQuery.isLoading,
  });
  const baseSnapshot = selectNewestSnapshot(
    (query.data as WorkspaceSessionsSnapshot | undefined) ?? null,
    cachedQuery.data ?? null,
  );
  const liveSnapshot = baseSnapshot
    ? pruneLiveSnapshot(liveQuery.data ?? null, baseSnapshot.refreshed_at)
    : liveQuery.data;

  useEffect(() => {
    if (!baseSnapshot) {
      return;
    }

    queryClient.setQueryData(
      monitorQueryKeys.workspaceSessionsLive(),
      (current: WorkspaceSessionsSnapshot | undefined) =>
        pruneLiveSnapshot(current ?? null, baseSnapshot.refreshed_at),
    );
  }, [baseSnapshot?.refreshed_at, queryClient]);

  const snapshot = baseSnapshot
    ? mergeBootstrapSnapshot(baseSnapshot, liveSnapshot)
    : liveSnapshot;
  const sourceError = query.error ?? (query.data ? null : cachedQuery.error);
  const errorMessage =
    sourceError instanceof Error
      ? sourceError.message
      : sourceError
        ? String(sourceError)
        : null;
  const loading = enabled
    ? !snapshot && (cachedQuery.isLoading || cachedQuery.isPending || query.isLoading)
    : false;

  return {
    ...query,
    errorMessage,
    loading,
    snapshot: snapshot ?? null,
  };
}
