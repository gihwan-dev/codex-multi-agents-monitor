import {
  startTransition,
  useEffect,
  useEffectEvent,
  useReducer,
  useRef,
} from "react";
import { LIVE_FIXTURE_FRAMES } from "../../../entities/run/testing";
import {
  loadArchivedSessionIndex,
  loadRecentSessionIndex,
  loadRecentSessionSnapshot,
} from "../../../entities/session-log";
import { useMonitorKeyboardShortcuts } from "../lib/useMonitorKeyboardShortcuts";
import { createMonitorActions } from "./createMonitorActions";
import { deriveMonitorViewState } from "./deriveMonitorViewState";
import {
  ARCHIVE_PAGE_SIZE,
  createMonitorInitialState,
  LIVE_FIXTURE_TRACE_ID,
  monitorStateReducer,
} from "./state";

export function useMonitorPageState() {
  const [state, dispatch] = useReducer(
    monitorStateReducer,
    undefined,
    createMonitorInitialState,
  );
  const recentSnapshotRequestIdRef = useRef(0);
  const archiveIndexRequestIdRef = useRef(0);
  const archiveSnapshotRequestIdRef = useRef(0);
  const derivedState = deriveMonitorViewState(state);

  const cancelPendingSelectionLoad = useEffectEvent(() => {
    const nextRecentRequestId = recentSnapshotRequestIdRef.current + 1;
    recentSnapshotRequestIdRef.current = nextRecentRequestId;
    dispatch({
      type: "cancel-recent-snapshot-request",
      requestId: nextRecentRequestId,
    });

    const nextArchivedRequestId = archiveSnapshotRequestIdRef.current + 1;
    archiveSnapshotRequestIdRef.current = nextArchivedRequestId;
    dispatch({
      type: "cancel-archived-snapshot-request",
      requestId: nextArchivedRequestId,
    });
  });

  const requestRecentIndex = useEffectEvent(() => {
    dispatch({ type: "begin-recent-index-request" });

    loadRecentSessionIndex().then((items) => {
      if (items === null) {
        dispatch({
          type: "finish-recent-index-request",
          error: "Recent sessions are unavailable right now.",
        });
        return;
      }

      startTransition(() => {
        dispatch({ type: "resolve-recent-index-request", items });
      });
    });
  });

  const requestRecentSnapshot = useEffectEvent((filePath: string) => {
    cancelPendingSelectionLoad();

    const cachedDataset = state.hydratedDatasetsByFilePath[filePath];
    if (cachedDataset) {
      dispatch({ type: "set-active-run", traceId: cachedDataset.run.traceId });
      return;
    }

    const requestId = recentSnapshotRequestIdRef.current + 1;
    recentSnapshotRequestIdRef.current = requestId;
    dispatch({ type: "begin-recent-snapshot-request", requestId, filePath });

    loadRecentSessionSnapshot(filePath).then((dataset) => {
      if (!dataset) {
        dispatch({ type: "finish-recent-snapshot-request", requestId });
        return;
      }

      dispatch({
        type: "begin-recent-snapshot-build",
        requestId,
        filePath,
      });
      startTransition(() => {
        dispatch({
          type: "resolve-recent-snapshot-request",
          requestId,
          filePath,
          dataset,
        });
      });
    });
  });

  const requestArchiveIndex = useEffectEvent(
    (offset: number, append: boolean, search?: string) => {
      const requestId = archiveIndexRequestIdRef.current + 1;
      archiveIndexRequestIdRef.current = requestId;
      dispatch({ type: "begin-archived-index-request", requestId });

      loadArchivedSessionIndex(offset, ARCHIVE_PAGE_SIZE, search).then((result) => {
        if (!result) {
          dispatch({
            type: "finish-archived-index-request",
            requestId,
            error: "Archive sessions are unavailable right now.",
          });
          return;
        }

        startTransition(() => {
          dispatch({
            type: "resolve-archived-index-request",
            requestId,
            result,
            append,
          });
        });
      });
    },
  );

  useEffect(() => {
    requestRecentIndex();
  }, []);

  useEffect(() => {
    if (
      !state.recentIndexReady ||
      !state.recentIndex.length ||
      state.recentSnapshotLoadingId ||
      derivedState.activeDataset
    ) {
      return;
    }

    requestRecentSnapshot(state.recentIndex[0].filePath);
  }, [
    state.recentIndexReady,
    state.recentIndex,
    state.recentSnapshotLoadingId,
    derivedState.activeDataset,
  ]);

  useEffect(() => {
    const liveFixtureRun = state.datasets.find(
      (item) => item.run.traceId === LIVE_FIXTURE_TRACE_ID,
    );
    if (!liveFixtureRun || liveFixtureRun.run.liveMode !== "live") {
      return undefined;
    }

    if (state.appliedLiveFrames >= LIVE_FIXTURE_FRAMES.length) {
      return undefined;
    }

    const frame = LIVE_FIXTURE_FRAMES[state.appliedLiveFrames];
    const timeout = window.setTimeout(() => {
      dispatch({ type: "apply-live-frame" });
    }, frame.delayMs);

    return () => window.clearTimeout(timeout);
  }, [state.appliedLiveFrames, state.datasets]);

  useMonitorKeyboardShortcuts({
    dispatch,
    activeDataset: derivedState.activeDataset,
    selection: state.selection,
    graphRows: derivedState.graphScene.rows,
  });

  useEffect(() => {
    requestArchiveIndex(0, false);
  }, []);

  return {
    state,
    ...derivedState,
    actions: createMonitorActions({
      state,
      dispatch,
      activeDataset: derivedState.activeDataset,
      activeFollowLive: derivedState.activeFollowLive,
      requestRecentSnapshot,
      requestArchiveIndex,
      archiveSnapshotRequestIdRef,
      cancelPendingSelectionLoad,
    }),
  };
}
