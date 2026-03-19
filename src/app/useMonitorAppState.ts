import {
  startTransition,
  useEffect,
  useEffectEvent,
  useReducer,
  useRef,
} from "react";
import { LIVE_FIXTURE_FRAMES } from "../features/fixtures";
import {
  createMonitorActions,
} from "./createMonitorActions";
import {
  ARCHIVE_PAGE_SIZE,
  createMonitorInitialState,
  LIVE_FIXTURE_TRACE_ID,
  monitorStateReducer,
} from "./monitorState";
import {
  loadArchivedSessionIndex,
  loadSessionLogDatasets,
} from "./sessionLogLoader";
import { deriveMonitorViewState } from "./useMonitorAppDerivedState";
import { useMonitorKeyboardShortcuts } from "./useMonitorKeyboardShortcuts";

export function useMonitorAppState() {
  const [state, dispatch] = useReducer(
    monitorStateReducer,
    undefined,
    createMonitorInitialState,
  );
  const archiveIndexRequestIdRef = useRef(0);
  const archiveSnapshotRequestIdRef = useRef(0);
  const derivedState = deriveMonitorViewState(state);

  const requestArchiveIndex = useEffectEvent(
    (offset: number, append: boolean, search?: string) => {
      const requestId = archiveIndexRequestIdRef.current + 1;
      archiveIndexRequestIdRef.current = requestId;
      dispatch({ type: "begin-archived-index-request", requestId });

      loadArchivedSessionIndex(offset, ARCHIVE_PAGE_SIZE, search).then((result) => {
        if (!result) {
          dispatch({ type: "finish-archived-index-request", requestId });
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
    let cancelled = false;

    loadSessionLogDatasets().then((datasets) => {
      if (cancelled || !datasets?.length) {
        return;
      }

      startTransition(() => {
        dispatch({ type: "replace-datasets", datasets });
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

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
    activeFilters: derivedState.activeFilters,
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
      requestArchiveIndex,
      archiveSnapshotRequestIdRef,
    }),
  };
}
