import type { MutableRefObject } from "react";
import type { RunDataset } from "../../../entities/run";
import type { MonitorState } from "./state";

export interface UseMonitorBootstrapOptions {
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

export type InitialRecentSnapshotState = Pick<
  UseMonitorBootstrapOptions,
  "activeDataset" | "recentIndex" | "recentIndexReady" | "recentSnapshotLoadingId"
>;

export type RecentRefreshState = Pick<
  UseMonitorBootstrapOptions,
  "activeDataset" | "activeFollowLive" | "activeSessionFilePath" | "recentIndex"
>;

export interface UseInitialRecentSnapshotOptions extends InitialRecentSnapshotState {
  requestRecentSnapshotRef: MutableRefObject<(filePath: string) => void>;
}

export interface UseRecentLiveRefreshOptions extends RecentRefreshState {
  refreshRecentSnapshotRef: MutableRefObject<(filePath: string) => void>;
}

export interface MonitorBootstrapRefs {
  requestRecentIndexRef: MutableRefObject<() => void>;
  requestRecentSnapshotRef: MutableRefObject<(filePath: string) => void>;
  requestArchiveIndexRef: MutableRefObject<
    UseMonitorBootstrapOptions["requestArchiveIndex"]
  >;
  refreshRecentSnapshotRef: MutableRefObject<(filePath: string) => void>;
}

export interface MonitorBootstrapEffectOptions
  extends UseMonitorBootstrapOptions,
    MonitorBootstrapRefs {}
