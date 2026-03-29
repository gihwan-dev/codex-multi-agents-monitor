import type { MutableRefObject } from "react";
import type { RunDataset } from "../../../entities/run";
import type { RecentSessionLiveUpdate } from "../../../entities/session-log";
import type { MonitorState } from "./state";

export interface UseMonitorBootstrapOptions {
  activeDataset: RunDataset | null;
  activeSessionFilePath: string | null;
  recentIndex: MonitorState["recentIndex"];
  recentIndexReady: boolean;
  recentSnapshotLoadingId: string | null;
  handleRecentLiveUpdate: (update: RecentSessionLiveUpdate) => void;
  requestArchiveIndex: (offset: number, append: boolean, search?: string) => void;
  requestRecentIndex: () => void;
  requestRecentSnapshot: (filePath: string) => void;
}

export type InitialRecentSnapshotState = Pick<
  UseMonitorBootstrapOptions,
  "activeDataset" | "recentIndex" | "recentIndexReady" | "recentSnapshotLoadingId"
>;

export type RecentRefreshState = Pick<
  UseMonitorBootstrapOptions,
  "activeDataset" | "activeSessionFilePath" | "recentIndex"
>;

export interface UseInitialRecentSnapshotOptions extends InitialRecentSnapshotState {
  requestRecentSnapshotRef: MutableRefObject<(filePath: string) => void>;
}

export interface UseRecentLiveSubscriptionOptions extends RecentRefreshState {
  handleRecentLiveUpdateRef: MutableRefObject<
    (update: RecentSessionLiveUpdate) => void
  >;
}

export interface MonitorBootstrapRefs {
  requestRecentIndexRef: MutableRefObject<() => void>;
  requestRecentSnapshotRef: MutableRefObject<(filePath: string) => void>;
  requestArchiveIndexRef: MutableRefObject<
    UseMonitorBootstrapOptions["requestArchiveIndex"]
  >;
  handleRecentLiveUpdateRef: MutableRefObject<
    (update: RecentSessionLiveUpdate) => void
  >;
}

export interface MonitorBootstrapEffectOptions
  extends UseMonitorBootstrapOptions,
    MonitorBootstrapRefs {}
