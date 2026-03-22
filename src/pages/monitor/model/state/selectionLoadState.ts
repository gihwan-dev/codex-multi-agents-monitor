export type SelectionLoadSource = "recent" | "archived";

export type SelectionLoadPhase =
  | "indexing_recent"
  | "loading_snapshot"
  | "building_graph";

export interface SelectionLoadState {
  source: SelectionLoadSource;
  filePath: string | null;
  phase: SelectionLoadPhase;
  announcement: string;
}

interface SelectionLoadDescription {
  title: string;
  message: string;
  phaseLabel: string;
}

function phaseAnnouncement(phase: SelectionLoadPhase) {
  switch (phase) {
    case "indexing_recent":
      return "Preparing recent sessions";
    case "loading_snapshot":
      return "Opening selected run";
    case "building_graph":
      return "Building graph view";
  }
}

export function createSelectionLoadState(
  source: SelectionLoadSource,
  filePath: string | null,
  phase: SelectionLoadPhase,
): SelectionLoadState {
  return {
    source,
    filePath,
    phase,
    announcement: phaseAnnouncement(phase),
  };
}

export function describeSelectionLoadState(
  loadState: SelectionLoadState | null,
): SelectionLoadDescription | null {
  if (!loadState) {
    return null;
  }

  switch (loadState.phase) {
    case "indexing_recent":
      return {
        title: "Preparing recent sessions",
        message: "Recent sessions will appear here as soon as they are ready.",
        phaseLabel: loadState.announcement,
      };
    case "loading_snapshot":
      return {
        title: "Preparing run details",
        message: "The selected run is opening now.",
        phaseLabel: loadState.announcement,
      };
    case "building_graph":
      return {
        title: "Preparing run details",
        message: "The graph view is being assembled now.",
        phaseLabel: loadState.announcement,
      };
  }
}
