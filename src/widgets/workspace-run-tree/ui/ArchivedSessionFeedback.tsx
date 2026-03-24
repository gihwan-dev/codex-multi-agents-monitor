import type { ReactNode, RefObject } from "react";

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

interface ArchivedSessionFeedbackProps extends ArchivedSessionFeedbackStateArgs {
  localSearch: string;
  sentinelRef: RefObject<HTMLDivElement | null>;
}

function resolveArchivedSessionFeedbackState(
  args: ArchivedSessionFeedbackStateArgs,
): ArchivedSessionFeedbackState {
  const matchedState = archivedSessionFeedbackStates.find(({ matches }) => matches(args));

  if (matchedState) {
    return matchedState.state;
  }

  return args.hasMore && !args.searchPending ? "sentinel" : "idle";
}

function renderLoadingFeedback() {
  return (
    <>
      <div className="h-9 animate-pulse rounded-md bg-white/[0.03]" aria-hidden="true" />
      <div className="h-9 animate-pulse rounded-md bg-white/[0.03]" aria-hidden="true" />
      <div className="h-9 animate-pulse rounded-md bg-white/[0.03]" aria-hidden="true" />
    </>
  );
}

function renderErrorFeedback(errorMessage: string | null) {
  return (
    <output className="text-sm text-[var(--color-failed)]" aria-live="polite">
      {errorMessage}
    </output>
  );
}

function renderEmptyFeedback(localSearch: string) {
  return (
    <p className="px-2 py-2 text-[0.78rem] text-[var(--color-text-tertiary)]">
      {localSearch ? "No matching archived sessions." : "No archived sessions found."}
    </p>
  );
}

function renderSentinelFeedback(
  sentinelRef: RefObject<HTMLDivElement | null>,
) {
  return (
    <div
      ref={sentinelRef}
      data-slot="archive-sentinel"
      className="h-px"
      aria-hidden="true"
    />
  );
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
  const renderers = {
    empty: () => renderEmptyFeedback(localSearch),
    error: () => renderErrorFeedback(errorMessage),
    idle: () => null,
    loading: renderLoadingFeedback,
    sentinel: () => renderSentinelFeedback(sentinelRef),
  } satisfies Record<ArchivedSessionFeedbackState, () => ReactNode>;
  return renderers[state]();
}
