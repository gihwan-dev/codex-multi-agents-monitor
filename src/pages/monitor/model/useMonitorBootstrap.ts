import { useEffect, useRef } from "react";
import type { RunDataset } from "../../../entities/run";
import { canInvokeTauriRuntime } from "../../../shared/api";
import type { MonitorState } from "./state";

interface UseMonitorBootstrapOptions {
  activeDataset: RunDataset | null;
  recentIndex: MonitorState["recentIndex"];
  recentIndexReady: boolean;
  recentSnapshotLoadingId: string | null;
  requestArchiveIndex: (offset: number, append: boolean, search?: string) => void;
  requestRecentIndex: () => void;
  requestRecentSnapshot: (filePath: string) => void;
}

export function useMonitorBootstrap({
  activeDataset,
  recentIndex,
  recentIndexReady,
  recentSnapshotLoadingId,
  requestArchiveIndex,
  requestRecentIndex,
  requestRecentSnapshot,
}: UseMonitorBootstrapOptions) {
  const requestRecentIndexRef = useRef(requestRecentIndex);
  const requestRecentSnapshotRef = useRef(requestRecentSnapshot);
  const requestArchiveIndexRef = useRef(requestArchiveIndex);

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
}
