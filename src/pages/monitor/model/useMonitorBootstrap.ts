import { type MutableRefObject, useEffect, useEffectEvent, useRef } from "react";
import type { RunDataset } from "../../../entities/run";
import { canInvokeTauriRuntime } from "../../../shared/api";
import type { MonitorState } from "./state";

interface UseMonitorBootstrapOptions {
  activeDataset: RunDataset | null;
  activeFollowLive: boolean;
  activeSessionFilePath: string | null;
  recentIndex: MonitorState["recentIndex"];
  recentIndexReady: boolean;
  recentSnapshotLoadingId: string | null;
  refreshRecentSnapshot: (filePath: string) => void;
  requestArchiveIndex: (offset: number, append: boolean, search?: string) => void;
  requestRecentIndex: () => void;
  requestRecentSnapshot: (filePath: string) => void;
}

const LIVE_RECENT_POLL_INTERVAL_MS = 2_000;

type InitialRecentSnapshotState = Pick<
  UseMonitorBootstrapOptions,
  "activeDataset" | "recentIndex" | "recentIndexReady" | "recentSnapshotLoadingId"
>;

type RecentRefreshState = Pick<
  UseMonitorBootstrapOptions,
  "activeDataset" | "activeFollowLive" | "activeSessionFilePath" | "recentIndex"
>;

interface UseInitialRecentSnapshotOptions extends InitialRecentSnapshotState {
  requestRecentSnapshotRef: MutableRefObject<(filePath: string) => void>;
}

interface UseRecentLiveRefreshOptions extends RecentRefreshState {
  refreshRecentSnapshotRef: MutableRefObject<(filePath: string) => void>;
}

interface MonitorBootstrapRefs {
  requestRecentIndexRef: MutableRefObject<() => void>;
  requestRecentSnapshotRef: MutableRefObject<(filePath: string) => void>;
  requestArchiveIndexRef: MutableRefObject<
    UseMonitorBootstrapOptions["requestArchiveIndex"]
  >;
  refreshRecentSnapshotRef: MutableRefObject<(filePath: string) => void>;
}

interface MonitorBootstrapEffectOptions
  extends UseMonitorBootstrapOptions,
    MonitorBootstrapRefs {}

function useLatestRef<T>(value: T) {
  const ref = useRef(value);

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref;
}

function useMonitorBootstrapRefs(
  options: Pick<
    UseMonitorBootstrapOptions,
    | "refreshRecentSnapshot"
    | "requestArchiveIndex"
    | "requestRecentIndex"
    | "requestRecentSnapshot"
  >,
): MonitorBootstrapRefs {
  return {
    requestRecentIndexRef: useLatestRef(options.requestRecentIndex),
    requestRecentSnapshotRef: useLatestRef(options.requestRecentSnapshot),
    requestArchiveIndexRef: useLatestRef(options.requestArchiveIndex),
    refreshRecentSnapshotRef: useLatestRef(options.refreshRecentSnapshot),
  };
}

function useRecentIndexBootstrapRequest(
  requestRecentIndexRef: MutableRefObject<() => void>,
) {
  const requestRecentIndex = useEffectEvent(() => requestRecentIndexRef.current());

  useEffect(() => {
    if (!canInvokeTauriRuntime()) {
      return;
    }

    requestRecentIndex();
  }, []);
}

function useArchiveIndexBootstrapRequest(
  requestArchiveIndexRef: MutableRefObject<
    UseMonitorBootstrapOptions["requestArchiveIndex"]
  >,
) {
  const requestArchiveIndex = useEffectEvent(() => requestArchiveIndexRef.current(0, false));

  useEffect(() => {
    if (!canInvokeTauriRuntime()) {
      return;
    }

    requestArchiveIndex();
  }, []);
}

function shouldRequestInitialRecentSnapshot(options: InitialRecentSnapshotState) {
  const { activeDataset, recentIndex, recentIndexReady, recentSnapshotLoadingId } = options;
  return Boolean(
    recentIndexReady &&
      recentIndex.length > 0 &&
      !recentSnapshotLoadingId &&
      !activeDataset,
  );
}

function useInitialRecentSnapshot(options: UseInitialRecentSnapshotOptions) {
  const {
    activeDataset,
    recentIndex,
    recentIndexReady,
    recentSnapshotLoadingId,
    requestRecentSnapshotRef,
  } = options;

  useEffect(() => {
    if (
      !shouldRequestInitialRecentSnapshot({
        activeDataset,
        recentIndex,
        recentIndexReady,
        recentSnapshotLoadingId,
      })
    ) {
      return;
    }

    requestRecentSnapshotRef.current?.(recentIndex[0].filePath);
  }, [
    activeDataset,
    recentIndex,
    recentIndexReady,
    recentSnapshotLoadingId,
    requestRecentSnapshotRef,
  ]);
}

function shouldRefreshRecentSnapshot(options: RecentRefreshState) {
  const {
    activeDataset,
    activeFollowLive,
    activeSessionFilePath,
    recentIndex,
  } = options;
  if (!canInvokeTauriRuntime() || !activeDataset || !activeSessionFilePath) {
    return false;
  }

  return Boolean(
    recentIndex.some((item) => item.filePath === activeSessionFilePath) &&
      !activeDataset.run.isArchived &&
      activeDataset.run.liveMode === "live" &&
      activeFollowLive,
  );
}

function useRecentLiveRefresh(options: UseRecentLiveRefreshOptions) {
  const {
    activeDataset,
    activeFollowLive,
    activeSessionFilePath,
    recentIndex,
    refreshRecentSnapshotRef,
  } = options;
  const shouldRefresh = shouldRefreshRecentSnapshot({
    activeDataset,
    activeFollowLive,
    activeSessionFilePath,
    recentIndex,
  });

  useEffect(() => {
    if (!shouldRefresh || !activeSessionFilePath) {
      return undefined;
    }

    refreshRecentSnapshotRef.current?.(activeSessionFilePath);
    const intervalId = window.setInterval(() => {
      refreshRecentSnapshotRef.current?.(activeSessionFilePath);
    }, LIVE_RECENT_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeSessionFilePath, refreshRecentSnapshotRef, shouldRefresh]);
}

export function useMonitorBootstrap(options: UseMonitorBootstrapOptions) {
  useMonitorBootstrapEffects({
    ...options,
    ...useMonitorBootstrapRefs(options),
  });
}

function useMonitorBootstrapEffects(options: MonitorBootstrapEffectOptions) {
  const {
    activeDataset,
    activeFollowLive,
    activeSessionFilePath,
    recentIndex,
    recentIndexReady,
    recentSnapshotLoadingId,
    requestRecentIndexRef,
    requestRecentSnapshotRef,
    requestArchiveIndexRef,
    refreshRecentSnapshotRef,
  } = options;
  useRecentIndexBootstrapRequest(requestRecentIndexRef);
  useArchiveIndexBootstrapRequest(requestArchiveIndexRef);
  useInitialRecentSnapshot({
    activeDataset,
    recentIndex,
    recentIndexReady,
    recentSnapshotLoadingId,
    requestRecentSnapshotRef,
  });
  useRecentLiveRefresh({
    activeDataset,
    activeFollowLive,
    activeSessionFilePath,
    recentIndex,
    refreshRecentSnapshotRef,
  });
}
