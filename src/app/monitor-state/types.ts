import type {
  ArchivedSessionIndexItem,
  ArchivedSessionIndexResult,
  DrawerTab,
  RunDataset,
  RunFilters,
  SelectionState,
} from "../../shared/domain";

export type LiveConnection =
  | "live"
  | "stale"
  | "disconnected"
  | "reconnected"
  | "paused";

export interface MonitorState {
  datasets: RunDataset[];
  activeRunId: string;
  selection: SelectionState | null;
  drawerTab: DrawerTab;
  drawerOpen: boolean;
  inspectorOpen: boolean;
  followLiveByRunId: Record<string, boolean>;
  liveConnectionByRunId: Record<string, LiveConnection>;
  filtersByRunId: Record<string, RunFilters>;
  collapsedGapIds: Record<string, string[]>;
  railWidth: number;
  inspectorWidth: number;
  importText: string;
  allowRawImport: boolean;
  noRawStorage: boolean;
  exportText: string;
  shortcutHelpOpen: boolean;
  appliedLiveFrames: number;
  archivedIndex: ArchivedSessionIndexItem[];
  archivedTotal: number;
  archivedHasMore: boolean;
  archivedSearch: string;
  archivedIndexLoading: boolean;
  archivedSnapshotLoading: boolean;
  archivedIndexRequestId: number;
  archivedSnapshotRequestId: number;
  archiveSectionOpen: boolean;
}

export type MonitorAction =
  | { type: "set-active-run"; traceId: string }
  | { type: "set-selection"; selection: SelectionState | null }
  | { type: "set-drawer-tab"; tab: DrawerTab; open?: boolean }
  | { type: "toggle-drawer" }
  | { type: "toggle-inspector" }
  | { type: "toggle-follow-live"; traceId: string }
  | { type: "set-follow-live"; traceId: string; value: boolean }
  | {
      type: "set-filter";
      traceId: string;
      key: keyof RunFilters;
      value: string | boolean | null;
    }
  | { type: "toggle-gap"; traceId: string; gapId: string }
  | { type: "set-rail-width"; width: number }
  | { type: "set-inspector-width"; width: number }
  | { type: "set-import-text"; value: string }
  | { type: "set-allow-raw"; value: boolean }
  | { type: "set-no-raw"; value: boolean }
  | { type: "set-export-text"; value: string; open?: boolean }
  | { type: "toggle-shortcuts" }
  | { type: "import-dataset"; dataset: RunDataset }
  | { type: "replace-datasets"; datasets: RunDataset[] }
  | { type: "apply-live-frame" }
  | { type: "begin-archived-index-request"; requestId: number }
  | {
      type: "resolve-archived-index-request";
      requestId: number;
      result: ArchivedSessionIndexResult;
      append: boolean;
    }
  | { type: "finish-archived-index-request"; requestId: number }
  | { type: "begin-archived-snapshot-request"; requestId: number }
  | {
      type: "resolve-archived-snapshot-request";
      requestId: number;
      dataset: RunDataset;
    }
  | { type: "finish-archived-snapshot-request"; requestId: number }
  | { type: "set-archived-search"; value: string }
  | { type: "toggle-archive-section" };
