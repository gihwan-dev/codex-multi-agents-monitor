import type {
  RunDataset,
  SelectionPath,
} from "../model/types.js";
import {
  buildSelectionResult,
  includeEdgeTopology,
  includeSpawnLaneEvents,
  syncLaneIds,
} from "./graphSelectionTopology.js";
import {
  buildSelectionContext,
  createTraversalState,
  expandSelectionEvents,
} from "./graphSelectionTraversalCore.js";

export function buildSelectionPathFromBaseEvents(
  dataset: RunDataset,
  baseEventIds: string[],
): SelectionPath {
  const context = buildSelectionContext(dataset);
  const state = createTraversalState(baseEventIds);

  expandSelectionEvents(context, state);
  includeEdgeTopology({ dataset, context, state, edgeType: "spawn" });
  includeSpawnLaneEvents(dataset, state);
  includeEdgeTopology({ dataset, context, state, edgeType: "merge" });
  syncLaneIds(dataset, state);

  return buildSelectionResult(dataset, state);
}
