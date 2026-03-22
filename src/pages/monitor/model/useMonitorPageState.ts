import {
  useReducer,
} from "react";
import { useMonitorKeyboardShortcuts } from "../lib/useMonitorKeyboardShortcuts";
import { createMonitorActions } from "./createMonitorActions";
import { deriveMonitorViewState } from "./deriveMonitorViewState";
import {
  createMonitorInitialState,
  monitorStateReducer,
} from "./state";
import { useLiveFixturePlayback } from "./useLiveFixturePlayback";
import { useMonitorBootstrap } from "./useMonitorBootstrap";
import { useMonitorRequestController } from "./useMonitorRequestController";

export function useMonitorPageState() {
  const [state, dispatch] = useReducer(
    monitorStateReducer,
    undefined,
    createMonitorInitialState,
  );
  const derivedState = deriveMonitorViewState(state);
  const {
    loadArchiveIndex,
    requestArchiveIndex,
    requestRecentIndex,
    requestRecentSnapshot,
    searchArchive,
    selectArchivedSession,
  } = useMonitorRequestController({
    state,
    dispatch,
  });

  useMonitorBootstrap({
    activeDataset: derivedState.activeDataset,
    recentIndex: state.recentIndex,
    recentIndexReady: state.recentIndexReady,
    recentSnapshotLoadingId: state.recentSnapshotLoadingId,
    requestArchiveIndex,
    requestRecentIndex,
    requestRecentSnapshot,
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

  return {
    state,
    ...derivedState,
    actions: createMonitorActions({
      state,
      dispatch,
      activeDataset: derivedState.activeDataset,
      activeFollowLive: derivedState.activeFollowLive,
      loadArchiveIndex,
      searchArchive,
      selectArchivedSession,
      requestRecentSnapshot,
    }),
  };
}
