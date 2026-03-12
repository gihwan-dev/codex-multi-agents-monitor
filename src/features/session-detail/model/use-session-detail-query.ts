import { skipToken, useQuery } from "@tanstack/react-query";

import type { SessionDetailSnapshot } from "@/shared/queries";
import { monitorQueryKeys, sessionDetailQueryOptions } from "@/shared/query";

export function useSessionDetailQuery(sessionId: string | null) {
  const query = useQuery(
    sessionId
      ? sessionDetailQueryOptions(sessionId)
      : {
          queryKey: monitorQueryKeys.sessionDetail(null),
          queryFn: skipToken,
        },
  );

  return {
    ...query,
    detail: (query.data ?? null) as SessionDetailSnapshot | null,
    errorMessage:
      query.error instanceof Error
        ? query.error.message
        : query.error
          ? String(query.error)
          : null,
    loading: query.isLoading,
  };
}
