import { useReducer } from "react";
import { useMonitorKeyboardShortcuts } from "../lib/useMonitorKeyboardShortcuts";
import { createMonitorActions } from "./createMonitorActions";
import { deriveMonitorViewState } from "./deriveMonitorViewState";
import { createMonitorInitialState, monitorStateReducer } from "./state";
import { useLiveFixturePlayback } from "./useLiveFixturePlayback";
import { useMonitorBootstrap } from "./useMonitorBootstrap";
import { useMonitorRequestController } from "./useMonitorRequestController";

function useMonitorPageRuntime() {
  const [state, dispatch] = useReducer(monitorStateReducer, undefined, createMonitorInitialState);
  const derivedState = deriveMonitorViewState(state);
  const controller = useMonitorRequestController({ state, dispatch });

  useMonitorBootstrap({
    activeDataset: derivedState.activeDataset,
    activeSessionFilePath: derivedState.activeSessionFilePath,
    recentIndex: state.recentIndex,
    recentIndexReady: state.recentIndexReady,
    recentSnapshotLoadingId: state.recentSnapshotLoadingId,
    handleRecentLiveUpdate: controller.handleRecentLiveUpdate,
    requestArchiveIndex: controller.requestArchiveIndex,
    requestRecentIndex: controller.requestRecentIndex,
    requestRecentSnapshot: controller.requestRecentSnapshot,
  });
  useLiveFixturePlayback({
    datasets: state.datasets,
    appliedLiveFrames: state.appliedLiveFrames,
    dispatch,
  });
  useMonitorKeyboardShortcuts({
    dispatch,
    activeDataset: derivedState.activeDataset,
    selection: state.selection,
    graphRows: derivedState.graphScene.rows,
  });

  return { state, dispatch, derivedState, controller };
}

export function useMonitorPageState() {
  const { state, dispatch, derivedState, controller } = useMonitorPageRuntime();
  const actions = createMonitorActions({ state, dispatch, activeDataset: derivedState.activeDataset, activeFollowLive: derivedState.activeFollowLive, loadArchiveIndex: controller.loadArchiveIndex, searchArchive: controller.searchArchive, selectArchivedSession: controller.selectArchivedSession, requestRecentSnapshot: controller.requestRecentSnapshot });

  return {
    state,
    ...derivedState,
    actions,
  };
}
