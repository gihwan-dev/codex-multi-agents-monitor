import type { RefObject } from "react";

import type {
  ArchivedSessionFeedbackState,
} from "./archivedSessionFeedbackState";

interface RenderArchivedSessionFeedbackOptions {
  state: ArchivedSessionFeedbackState;
  errorMessage: string | null;
  localSearch: string;
  sentinelRef: RefObject<HTMLDivElement | null>;
}

export function renderArchivedSessionFeedback(options: RenderArchivedSessionFeedbackOptions) {
  switch (options.state) {
    case "loading":
      return (
        <>
          <div className="h-9 animate-pulse rounded-md bg-white/[0.03]" aria-hidden="true" />
          <div className="h-9 animate-pulse rounded-md bg-white/[0.03]" aria-hidden="true" />
          <div className="h-9 animate-pulse rounded-md bg-white/[0.03]" aria-hidden="true" />
        </>
      );
    case "error":
      return <output className="text-sm text-[var(--color-failed)]" aria-live="polite">{options.errorMessage}</output>;
    case "empty":
      return <p className="px-2 py-2 text-[0.78rem] text-[var(--color-text-tertiary)]">{options.localSearch ? "No matching archived sessions." : "No archived sessions found."}</p>;
    case "sentinel":
      return <div ref={options.sentinelRef} data-slot="archive-sentinel" className="h-px" aria-hidden="true" />;
    default:
      return null;
  }
}
