import type { RefObject } from "react";

const archivedSessionFeedbackStates = [
  {
    matches: ({ indexLoading }: ArchivedSessionFeedbackStateArgs) => indexLoading,
    state: "loading",
  },
  {
    matches: ({ errorMessage, searchPending }: ArchivedSessionFeedbackStateArgs) =>
      !searchPending && Boolean(errorMessage),
    state: "error",
  },
  {
    matches: ({ itemsLength, searchPending }: ArchivedSessionFeedbackStateArgs) =>
      !searchPending && itemsLength === 0,
    state: "empty",
  },
] as const;

type ArchivedSessionFeedbackState = (typeof archivedSessionFeedbackStates)[number]["state"] | "idle" | "sentinel";

interface ArchivedSessionFeedbackStateArgs {
  errorMessage: string | null;
  hasMore: boolean;
  indexLoading: boolean;
  itemsLength: number;
  searchPending: boolean;
}

function resolveArchivedSessionFeedbackState(args: {
  errorMessage: string | null;
  hasMore: boolean;
  indexLoading: boolean;
  itemsLength: number;
  searchPending: boolean;
}): ArchivedSessionFeedbackState {
  const matchedState = archivedSessionFeedbackStates.find(({ matches }) => matches(args));

  if (matchedState) {
    return matchedState.state;
  }

  return args.hasMore && !args.searchPending ? "sentinel" : "idle";
}

export function ArchivedSessionFeedback({
  errorMessage,
  hasMore,
  indexLoading,
  itemsLength,
  localSearch,
  searchPending,
  sentinelRef,
}: {
  errorMessage: string | null;
  hasMore: boolean;
  indexLoading: boolean;
  itemsLength: number;
  localSearch: string;
  searchPending: boolean;
  sentinelRef: RefObject<HTMLDivElement | null>;
}) {
  const state = resolveArchivedSessionFeedbackState({
    errorMessage,
    hasMore,
    indexLoading,
    itemsLength,
    searchPending,
  });

  switch (state) {
    case "loading":
      return (
        <>
          <div className="h-9 animate-pulse rounded-md bg-white/[0.03]" aria-hidden="true" />
          <div className="h-9 animate-pulse rounded-md bg-white/[0.03]" aria-hidden="true" />
          <div className="h-9 animate-pulse rounded-md bg-white/[0.03]" aria-hidden="true" />
        </>
      );
    case "error":
      return (
        <output className="text-sm text-[var(--color-failed)]" aria-live="polite">
          {errorMessage}
        </output>
      );
    case "empty":
      return (
        <p className="px-2 py-2 text-[0.78rem] text-[var(--color-text-tertiary)]">
          {localSearch ? "No matching archived sessions." : "No archived sessions found."}
        </p>
      );
    case "idle":
      return null;
    case "sentinel":
      return (
        <div
          ref={sentinelRef}
          data-slot="archive-sentinel"
          className="h-px"
          aria-hidden="true"
        />
      );
  }
}
