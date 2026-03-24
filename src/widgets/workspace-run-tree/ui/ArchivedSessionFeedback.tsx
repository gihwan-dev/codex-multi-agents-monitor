import type { RefObject } from "react";

import { renderArchivedSessionFeedback } from "./ArchivedSessionFeedbackContent";
import {
  type ArchivedSessionFeedbackStateArgs,
  resolveArchivedSessionFeedbackState,
} from "./archivedSessionFeedbackState";

interface ArchivedSessionFeedbackProps extends ArchivedSessionFeedbackStateArgs {
  localSearch: string;
  sentinelRef: RefObject<HTMLDivElement | null>;
}

export function ArchivedSessionFeedback({
  errorMessage,
  hasMore,
  indexLoading,
  itemsLength,
  localSearch,
  searchPending,
  sentinelRef,
}: ArchivedSessionFeedbackProps) {
  const state = resolveArchivedSessionFeedbackState({
    errorMessage,
    hasMore,
    indexLoading,
    itemsLength,
    searchPending,
  });
  return renderArchivedSessionFeedback({ state, errorMessage, localSearch, sentinelRef });
}
