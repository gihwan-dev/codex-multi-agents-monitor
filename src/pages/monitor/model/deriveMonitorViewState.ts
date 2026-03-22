import {
  buildAnomalyJumps,
  buildGraphSceneModel,
  buildInspectorCausalSummary,
  buildSummaryFacts,
  type GraphSceneModel,
  hasRawPayload,
} from "../../../entities/run";
import { deriveArchiveIndexTitle } from "../../../entities/session-log";
import type { MonitorState } from "./state";
import { describeSelectionLoadState } from "./state/selectionLoadState";

interface SelectionLoadingPresentation {
  title: string;
  message: string;
  phaseLabel: string;
  targetEyebrow?: string;
  targetTitle?: string;
  targetMeta?: string;
}

function resolveActiveDataset(state: MonitorState) {
  return (
    state.datasets.find((item) => item.run.traceId === state.activeRunId) ??
    state.datasets[0] ??
    null
  );
}

const EMPTY_GRAPH_SCENE: GraphSceneModel = {
  lanes: [],
  rows: [],
  edgeBundles: [],
  selectionPath: {
    eventIds: [],
    edgeIds: [],
    laneIds: [],
  },
  selectionRevealTarget: null,
  hiddenLaneCount: 0,
  latestVisibleEventId: null,
};

function resolveActiveSessionFilePath(state: MonitorState) {
  if (state.selectionLoadState?.filePath) {
    return state.selectionLoadState.filePath;
  }

  return (
    Object.entries(state.hydratedDatasetsByFilePath).find(
      ([, dataset]) => dataset.run.traceId === state.activeRunId,
    )?.[0] ?? null
  );
}

function fallbackLoadingTitleFromFilePath(filePath: string | null) {
  if (!filePath) {
    return undefined;
  }

  const segments = filePath.split("/").filter(Boolean);
  const normalized = segments[segments.length - 1] ?? filePath;
  return normalized.replace(/\.(json|jsonl)$/i, "");
}

function resolveSelectionLoadTarget(state: MonitorState) {
  const loadState = state.selectionLoadState;
  if (!loadState?.filePath) {
    return null;
  }

  if (loadState.source === "recent") {
    const recentItem =
      state.recentIndex.find((item) => item.filePath === loadState.filePath) ?? null;
    if (recentItem) {
      return {
        targetEyebrow: "Recent session",
        targetTitle: recentItem.title,
        targetMeta: recentItem.displayName,
      };
    }
  }

  if (loadState.source === "archived") {
    const archivedItem =
      state.archivedIndex.find((item) => item.filePath === loadState.filePath) ?? null;
    if (archivedItem) {
      return {
        targetEyebrow: "Archived session",
        targetTitle:
          deriveArchiveIndexTitle(archivedItem.firstUserMessage) ??
          fallbackLoadingTitleFromFilePath(archivedItem.filePath) ??
          archivedItem.sessionId,
        targetMeta: archivedItem.displayName,
      };
    }
  }

  const hydratedDataset = state.hydratedDatasetsByFilePath[loadState.filePath] ?? null;
  if (hydratedDataset) {
    return {
      targetEyebrow:
        loadState.source === "archived" ? "Archived session" : "Recent session",
      targetTitle: hydratedDataset.run.title,
      targetMeta: hydratedDataset.project.name,
    };
  }

  return {
    targetEyebrow:
      loadState.source === "archived" ? "Archived session" : "Recent session",
    targetTitle: fallbackLoadingTitleFromFilePath(loadState.filePath),
  };
}

export function deriveMonitorViewState(state: MonitorState) {
  const activeDataset = resolveActiveDataset(state);
  const graphScene = activeDataset
    ? buildGraphSceneModel(activeDataset, state.selection)
    : EMPTY_GRAPH_SCENE;
  const selectionLoadState = state.selectionLoadState;
  const baseSelectionLoadingPresentation = selectionLoadState
    ? describeSelectionLoadState(selectionLoadState)
    : null;
  const selectionLoadingPresentation: SelectionLoadingPresentation | null = baseSelectionLoadingPresentation
    ? {
        ...baseSelectionLoadingPresentation,
        ...resolveSelectionLoadTarget(state),
      }
    : null;
  const activeSessionFilePath = resolveActiveSessionFilePath(state);

  return {
    activeDataset,
    activeSessionFilePath,
    activeFollowLive: activeDataset
      ? state.followLiveByRunId[activeDataset.run.traceId] ?? false
      : false,
    activeLiveConnection:
      activeDataset
        ? state.liveConnectionByRunId[activeDataset.run.traceId] ??
          (activeDataset.run.liveMode === "live" ? "live" : "paused")
        : "paused",
    recentIndexReady: state.recentIndexReady,
    recentIndexLoading: state.recentIndexLoading,
    recentIndexError: state.recentIndexError,
    archivedIndexLoading: state.archivedIndexLoading,
    archivedIndexError: state.archivedIndexError,
    selectionLoadState,
    selectionLoadingPresentation,
    rawTabAvailable: activeDataset ? hasRawPayload(activeDataset) : false,
    graphScene,
    inspectorSummary: activeDataset
      ? buildInspectorCausalSummary(
          activeDataset,
          state.selection,
          activeDataset.run.rawIncluded,
        )
      : null,
    summaryFacts: activeDataset
      ? buildSummaryFacts(activeDataset, graphScene.selectionPath)
      : [],
    anomalyJumps: activeDataset ? buildAnomalyJumps(activeDataset) : [],
  };
}
