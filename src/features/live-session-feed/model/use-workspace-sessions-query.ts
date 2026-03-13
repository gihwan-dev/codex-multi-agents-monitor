import { useQuery } from "@tanstack/react-query";

import {
  mergeBootstrapSnapshot,
  type WorkspaceSessionsSnapshot,
} from "@/entities/session";
import {
  monitorQueryKeys,
  workspaceSessionsCachedQueryOptions,
  workspaceSessionsQueryOptions,
} from "@/shared/query";

export function useWorkspaceSessionsQuery(enabled = true) {
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
  const baseSnapshot =
    (query.data as WorkspaceSessionsSnapshot | undefined) ?? cachedQuery.data ?? null;
  const snapshot = baseSnapshot
    ? mergeBootstrapSnapshot(baseSnapshot, liveQuery.data)
    : liveQuery.data;
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
