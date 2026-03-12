import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { WorkspaceSessionsSnapshot } from "@/entities/session";
import { workspaceSessionsQueryOptions } from "@/shared/query";

export function useWorkspaceSessionsQuery() {
  const queryClient = useQueryClient();
  const query = useQuery(workspaceSessionsQueryOptions(queryClient));
  const snapshot = query.data ?? null;
  const errorMessage =
    query.error instanceof Error
      ? query.error.message
      : query.error
        ? String(query.error)
        : null;

  return {
    ...query,
    errorMessage,
    loading: query.isLoading,
    snapshot: snapshot as WorkspaceSessionsSnapshot | null,
  };
}
