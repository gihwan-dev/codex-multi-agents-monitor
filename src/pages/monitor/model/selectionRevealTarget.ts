import type {
  GraphSceneModel,
  GraphSelectionRevealTarget,
  SelectionState,
} from "../../../entities/run";
import type { MonitorState } from "./state";
import {
  buildArtifactRevealTarget,
  buildEdgeRevealTarget,
  buildEventRevealTarget,
} from "./selectionRevealTargetResolvers";

function collectVisibleEventIds(graphScene: GraphSceneModel) {
  return new Set(
    graphScene.rows.flatMap((row) => (row.kind === "event" ? [row.eventId] : [])),
  );
}

export function buildSelectionRevealTarget(options: {
  activeDataset: MonitorState["datasets"][number] | null;
  selection: SelectionState | null;
  graphScene: GraphSceneModel;
}): GraphSelectionRevealTarget | null {
  const { activeDataset, selection, graphScene } = options;
  if (!activeDataset || !selection) {
    return null;
  }

  const visibleEventIds = collectVisibleEventIds(graphScene);
  switch (selection.kind) {
    case "event":
      return buildEventRevealTarget(selection, visibleEventIds);
    case "edge":
      return buildEdgeRevealTarget(activeDataset, selection, visibleEventIds);
    case "artifact":
      return buildArtifactRevealTarget(activeDataset, selection, visibleEventIds);
  }
}
