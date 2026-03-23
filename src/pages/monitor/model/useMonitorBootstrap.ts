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

function useLatestRef<T>(value: T) {
  const ref = useRef(value);

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref;
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

function shouldRequestInitialRecentSnapshot({
  activeDataset,
  recentIndex,
  recentIndexReady,
  recentSnapshotLoadingId,
}: Pick<
  UseMonitorBootstrapOptions,
  "activeDataset" | "recentIndex" | "recentIndexReady" | "recentSnapshotLoadingId"
>) {
  return Boolean(
    recentIndexReady &&
      recentIndex.length > 0 &&
      !recentSnapshotLoadingId &&
      !activeDataset,
  );
}

function useInitialRecentSnapshot(
  options: Pick<
    UseMonitorBootstrapOptions,
    "activeDataset" | "recentIndex" | "recentIndexReady" | "recentSnapshotLoadingId"
  > & {
    requestRecentSnapshotRef: MutableRefObject<(filePath: string) => void>;
  },
) {
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

function shouldRefreshRecentSnapshot(
  {
    activeDataset,
    activeFollowLive,
    activeSessionFilePath,
    recentIndex,
  }: Pick<
    UseMonitorBootstrapOptions,
    "activeDataset" | "activeFollowLive" | "activeSessionFilePath" | "recentIndex"
  >,
) {
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

function useRecentLiveRefresh(
  {
    activeDataset,
    activeFollowLive,
    activeSessionFilePath,
    recentIndex,
  }: Pick<
    UseMonitorBootstrapOptions,
    "activeDataset" | "activeFollowLive" | "activeSessionFilePath" | "recentIndex"
  >,
  refreshRecentSnapshotRef: MutableRefObject<(filePath: string) => void>,
) {
  const shouldRefresh = shouldRefreshRecentSnapshot(
    {
      activeDataset,
      activeFollowLive,
      activeSessionFilePath,
      recentIndex,
    },
  );

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

export function useMonitorBootstrap({
  activeDataset,
  activeFollowLive,
  activeSessionFilePath,
  recentIndex,
  recentIndexReady,
  recentSnapshotLoadingId,
  refreshRecentSnapshot,
  requestArchiveIndex,
  requestRecentIndex,
  requestRecentSnapshot,
}: UseMonitorBootstrapOptions) {
  const requestRecentIndexRef = useLatestRef(requestRecentIndex);
  const requestRecentSnapshotRef = useLatestRef(requestRecentSnapshot);
  const requestArchiveIndexRef = useLatestRef(requestArchiveIndex);
  const refreshRecentSnapshotRef = useLatestRef(refreshRecentSnapshot);

  useRecentIndexBootstrapRequest(requestRecentIndexRef);
  useArchiveIndexBootstrapRequest(requestArchiveIndexRef);
  useInitialRecentSnapshot({
    activeDataset,
    recentIndex,
    recentIndexReady,
    recentSnapshotLoadingId,
    requestRecentSnapshotRef,
  });
  useRecentLiveRefresh(
    {
      activeDataset,
      activeFollowLive,
      activeSessionFilePath,
      recentIndex,
    },
    refreshRecentSnapshotRef,
  );
}
