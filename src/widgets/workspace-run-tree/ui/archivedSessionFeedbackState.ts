export const archivedSessionFeedbackStates = [
  { matches: ({ indexLoading }: ArchivedSessionFeedbackStateArgs) => indexLoading, state: "loading" },
  { matches: ({ errorMessage, searchPending }: ArchivedSessionFeedbackStateArgs) => !searchPending && Boolean(errorMessage), state: "error" },
  { matches: ({ itemsLength, searchPending }: ArchivedSessionFeedbackStateArgs) => !searchPending && itemsLength === 0, state: "empty" },
] as const;

export type ArchivedSessionFeedbackState =
  (typeof archivedSessionFeedbackStates)[number]["state"] | "idle" | "sentinel";

export interface ArchivedSessionFeedbackStateArgs {
  errorMessage: string | null;
  hasMore: boolean;
  indexLoading: boolean;
  itemsLength: number;
  searchPending: boolean;
}

export function resolveArchivedSessionFeedbackState(
  args: ArchivedSessionFeedbackStateArgs,
): ArchivedSessionFeedbackState {
  const matchedState = archivedSessionFeedbackStates.find(({ matches }) => matches(args));
  return matchedState ? matchedState.state : args.hasMore && !args.searchPending ? "sentinel" : "idle";
}
