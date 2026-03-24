import type {
  GraphSceneModel,
  GraphSelectionRevealTarget,
  SelectionState,
} from "../../../entities/run";
import type { MonitorState } from "./state";

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
      return visibleEventIds.has(selection.id)
        ? { kind: "event", eventId: selection.id }
        : null;
    case "edge": {
      const edge = activeDataset.edges.find((item) => item.edgeId === selection.id);
      if (!edge || !visibleEventIds.has(edge.sourceEventId) || !visibleEventIds.has(edge.targetEventId)) {
        return null;
      }

      return {
        kind: "edge",
        edgeId: edge.edgeId,
        sourceEventId: edge.sourceEventId,
        targetEventId: edge.targetEventId,
      };
    }
    case "artifact": {
      const artifact = activeDataset.artifacts.find((item) => item.artifactId === selection.id);
      return artifact && visibleEventIds.has(artifact.producerEventId)
        ? {
            kind: "artifact",
            artifactId: artifact.artifactId,
            producerEventId: artifact.producerEventId,
          }
        : null;
    }
  }
}
