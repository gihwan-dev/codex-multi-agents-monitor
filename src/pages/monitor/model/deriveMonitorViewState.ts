import { buildGraphSceneModel } from "../../../entities/run";
import {
  buildDatasetDerivedState,
  EMPTY_GRAPH_SCENE,
  resolveActiveDataset,
} from "./monitorViewDataset";
import {
  createSelectionLoadingPresentation,
  resolveActiveSessionFilePath,
} from "./monitorViewSelection";
import type { MonitorState } from "./state";

export function deriveMonitorViewState(state: MonitorState) {
  const activeDataset = resolveActiveDataset(state);
  const graphScene = activeDataset
    ? buildGraphSceneModel(activeDataset, state.selection)
    : EMPTY_GRAPH_SCENE;

  return {
    activeDataset,
    activeSessionFilePath: resolveActiveSessionFilePath(state),
    recentIndexReady: state.recentIndexReady,
    recentIndexLoading: state.recentIndexLoading,
    recentIndexError: state.recentIndexError,
    archivedIndexLoading: state.archivedIndexLoading,
    archivedIndexError: state.archivedIndexError,
    selectionLoadState: state.selectionLoadState,
    selectionLoadingPresentation: createSelectionLoadingPresentation(state),
    graphScene,
    ...buildDatasetDerivedState(activeDataset, state, graphScene),
  };
}
