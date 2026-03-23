import type { RunDataset, SelectionState } from "../../../../entities/run";
import { defaultSelectionForDataset } from "./helpers";
import type { MonitorState } from "./types";

type RecentIndexSelectionPatch = Pick<
  MonitorState,
  | "activeRunId"
  | "selection"
  | "selectionNavigationRequestId"
  | "selectionNavigationRunId"
>;

export function buildRecentIndexSelectionPatch(
  state: MonitorState,
  nextActiveRunId: string,
  fixtureActive: boolean,
): RecentIndexSelectionPatch {
  if (!fixtureActive) {
    return {
      activeRunId: state.activeRunId,
      selection: state.selection,
      selectionNavigationRequestId: state.selectionNavigationRequestId,
      selectionNavigationRunId: state.selectionNavigationRunId,
    };
  }

  return {
    activeRunId: nextActiveRunId,
    selection: null,
    selectionNavigationRequestId: 0,
    selectionNavigationRunId: null,
  };
}

export function resolveSelectionAfterRecentRefresh(
  state: MonitorState,
  dataset: RunDataset,
  followLive: boolean,
) {
  if (state.activeRunId !== dataset.run.traceId) {
    return state.selection;
  }

  if (followLive) {
    return buildLatestEventSelection(dataset);
  }

  if (!state.selection) {
    return defaultSelectionForDataset(dataset);
  }

  return selectionExistsInDataset(dataset, state.selection)
    ? state.selection
    : defaultSelectionForDataset(dataset);
}

function buildLatestEventSelection(dataset: RunDataset): SelectionState | null {
  const latestEvent = dataset.events[dataset.events.length - 1];
  return latestEvent ? { kind: "event", id: latestEvent.eventId } : null;
}

function selectionExistsInDataset(
  dataset: RunDataset,
  selection: SelectionState,
) {
  switch (selection.kind) {
    case "event":
      return dataset.events.some((event) => event.eventId === selection.id);
    case "edge":
      return dataset.edges.some((edge) => edge.edgeId === selection.id);
    case "artifact":
      return dataset.artifacts.some(
        (artifact) => artifact.artifactId === selection.id,
      );
    default:
      return false;
  }
}
