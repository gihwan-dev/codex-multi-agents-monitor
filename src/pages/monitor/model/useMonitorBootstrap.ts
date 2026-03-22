import { useEffect, useRef } from "react";
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
  const LIVE_RECENT_POLL_INTERVAL_MS = 2_000;
  const requestRecentIndexRef = useRef(requestRecentIndex);
  const requestRecentSnapshotRef = useRef(requestRecentSnapshot);
  const requestArchiveIndexRef = useRef(requestArchiveIndex);
  const refreshRecentSnapshotRef = useRef(refreshRecentSnapshot);

  useEffect(() => {
    requestRecentIndexRef.current = requestRecentIndex;
  }, [requestRecentIndex]);

  useEffect(() => {
    requestRecentSnapshotRef.current = requestRecentSnapshot;
  }, [requestRecentSnapshot]);

  useEffect(() => {
    requestArchiveIndexRef.current = requestArchiveIndex;
  }, [requestArchiveIndex]);

  useEffect(() => {
    refreshRecentSnapshotRef.current = refreshRecentSnapshot;
  }, [refreshRecentSnapshot]);

  useEffect(() => {
    if (!canInvokeTauriRuntime()) {
      return;
    }

    requestRecentIndexRef.current();
  }, []);

  useEffect(() => {
    if (
      !recentIndexReady ||
      !recentIndex.length ||
      recentSnapshotLoadingId ||
      activeDataset
    ) {
      return;
    }

    requestRecentSnapshotRef.current(recentIndex[0].filePath);
  }, [
    activeDataset,
    recentIndex,
    recentIndexReady,
    recentSnapshotLoadingId,
  ]);

  useEffect(() => {
    if (!canInvokeTauriRuntime()) {
      return;
    }

    requestArchiveIndexRef.current(0, false);
  }, []);

  useEffect(() => {
    if (!canInvokeTauriRuntime() || !activeDataset || !activeSessionFilePath) {
      return undefined;
    }

    const isRecentSnapshot = recentIndex.some(
      (item) => item.filePath === activeSessionFilePath,
    );
    if (
      !isRecentSnapshot ||
      activeDataset.run.isArchived ||
      activeDataset.run.liveMode !== "live" ||
      !activeFollowLive
    ) {
      return undefined;
    }

    refreshRecentSnapshotRef.current(activeSessionFilePath);
    const intervalId = window.setInterval(() => {
      refreshRecentSnapshotRef.current(activeSessionFilePath);
    }, LIVE_RECENT_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    activeDataset,
    activeFollowLive,
    activeSessionFilePath,
    recentIndex,
  ]);
}
