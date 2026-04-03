import { useMemo, useReducer } from "react";
import { useMonitorKeyboardShortcuts } from "../lib/useMonitorKeyboardShortcuts";
import { createMonitorActions } from "./createMonitorActions";
import { deriveMonitorViewState } from "./deriveMonitorViewState";
import { createMonitorInitialState, monitorStateReducer } from "./state";
import { useLiveFixturePlayback } from "./useLiveFixturePlayback";
import { useMonitorBootstrap } from "./useMonitorBootstrap";
import { useMonitorRequestController } from "./useMonitorRequestController";

function useMonitorPageRuntime(options: { isActive: boolean }) {
  const [state, dispatch] = useReducer(monitorStateReducer, undefined, createMonitorInitialState);
  const derivedState = useMemo(() => deriveMonitorViewState(state), [state]);
  const controller = useMonitorRequestController({ state, dispatch });

  useMonitorBootstrap({
    activeDataset: derivedState.activeDataset,
    activeSessionFilePath: derivedState.activeSessionFilePath,
    isActive: options.isActive,
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
    isActive: options.isActive,
    selection: state.selection,
    graphRows: derivedState.graphScene.rows,
  });

  return { state, dispatch, derivedState, controller };
}

export function useMonitorPageState(options?: { isActive?: boolean }) {
  const { state, dispatch, derivedState, controller } = useMonitorPageRuntime({
    isActive: options?.isActive ?? true,
  });
  const actions = useMemo(
    () =>
      createMonitorActions({
        state,
        dispatch,
        activeDataset: derivedState.activeDataset,
        activeFollowLive: derivedState.activeFollowLive,
        loadArchiveIndex: controller.loadArchiveIndex,
        refreshRecentIndex: controller.requestRecentIndex,
        searchArchive: controller.searchArchive,
        selectArchivedSession: controller.selectArchivedSession,
        requestRecentSnapshot: controller.requestRecentSnapshot,
      }),
    [
      state,
      dispatch,
      derivedState.activeDataset,
      derivedState.activeFollowLive,
      controller.loadArchiveIndex,
      controller.requestRecentIndex,
      controller.searchArchive,
      controller.selectArchivedSession,
      controller.requestRecentSnapshot,
    ],
  );

  return {
    state,
    ...derivedState,
    actions,
  };
}
