import { type MutableRefObject, useEffect, useEffectEvent, useRef } from "react";
import {
  type RecentSessionLiveUpdate,
  subscribeRecentSessionLive,
} from "../../../entities/session-log";
import { canInvokeTauriRuntime } from "../../../shared/api";
import type {
  InitialRecentSnapshotState,
  MonitorBootstrapEffectOptions,
  MonitorBootstrapRefs,
  RecentRefreshState,
  UseInitialRecentSnapshotOptions,
  UseMonitorBootstrapOptions,
  UseRecentLiveSubscriptionOptions,
} from "./monitorBootstrapTypes";

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
    | "handleRecentLiveUpdate"
    | "requestArchiveIndex"
    | "requestRecentIndex"
    | "requestRecentSnapshot"
  >,
): MonitorBootstrapRefs {
  return {
    requestRecentIndexRef: useLatestRef(options.requestRecentIndex),
    requestRecentSnapshotRef: useLatestRef(options.requestRecentSnapshot),
    requestArchiveIndexRef: useLatestRef(options.requestArchiveIndex),
    handleRecentLiveUpdateRef: useLatestRef(options.handleRecentLiveUpdate),
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
  const { activeDataset, activeSessionFilePath, recentIndex } = options;
  if (!canInvokeTauriRuntime() || !activeDataset || !activeSessionFilePath) {
    return false;
  }

  return Boolean(
    recentIndex.some((item) => item.filePath === activeSessionFilePath) &&
      !activeDataset.run.isArchived &&
      activeDataset.run.liveMode === "live",
  );
}

function useRecentLiveSubscription(options: UseRecentLiveSubscriptionOptions) {
  const {
    activeDataset,
    activeSessionFilePath,
    recentIndex,
    handleRecentLiveUpdateRef,
  } = options;
  const shouldRefresh = shouldRefreshRecentSnapshot({
    activeDataset,
    activeSessionFilePath,
    recentIndex,
  });
  const handleRecentLiveUpdate = useEffectEvent((update: RecentSessionLiveUpdate) => {
    handleRecentLiveUpdateRef.current(update);
  });

  useEffect(() => {
    if (!shouldRefresh || !activeSessionFilePath) {
      return undefined;
    }

    return subscribeRecentSessionLive(activeSessionFilePath, {
      onUpdate: handleRecentLiveUpdate,
    });
  }, [activeSessionFilePath, shouldRefresh]);
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
    activeSessionFilePath,
    recentIndex,
    recentIndexReady,
    recentSnapshotLoadingId,
    requestRecentIndexRef,
    requestRecentSnapshotRef,
    requestArchiveIndexRef,
    handleRecentLiveUpdateRef,
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
  useRecentLiveSubscription({
    activeDataset,
    activeSessionFilePath,
    recentIndex,
    handleRecentLiveUpdateRef,
  });
}
