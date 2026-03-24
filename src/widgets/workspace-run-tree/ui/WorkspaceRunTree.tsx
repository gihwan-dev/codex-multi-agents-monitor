import type { RefObject } from "react";
import type { RunDataset } from "../../../entities/run";
import type {
  ArchivedSessionIndexItem,
  RecentSessionIndexItem,
} from "../../../entities/session-log";
import type { WorkspaceIdentityOverrideMap } from "../../../entities/workspace";
import { Panel } from "../../../shared/ui";
import { useWorkspaceTreeState } from "../model/useWorkspaceTreeState";
import { WorkspaceRunTreeSections } from "./WorkspaceRunTreeSections";

interface WorkspaceRunTreeProps {
  datasets: RunDataset[];
  recentIndex: RecentSessionIndexItem[];
  recentIndexReady: boolean;
  activeRunId: string;
  onSelectRun: (traceId: string) => void;
  onSelectRecentRun: (filePath: string) => void;
  onOpenImport: () => void;
  searchRef: RefObject<HTMLInputElement | null>;
  workspaceIdentityOverrides: WorkspaceIdentityOverrideMap;
  archivedIndex: ArchivedSessionIndexItem[];
  archivedTotal: number;
  archivedHasMore: boolean;
  archivedIndexLoading: boolean;
  archivedIndexError: string | null;
  activeArchivedFilePath: string | null;
  archivedSearch: string;
  archiveSectionOpen: boolean;
  onToggleArchiveSection: () => void;
  onArchiveSearch: (query: string) => void;
  onArchiveLoadMore: () => void;
  onArchiveSelect: (filePath: string) => void;
}

export function WorkspaceRunTree({
  datasets,
  recentIndex,
  recentIndexReady,
  activeRunId,
  onSelectRun,
  onSelectRecentRun,
  onOpenImport,
  searchRef,
  workspaceIdentityOverrides,
  archivedIndex,
  archivedTotal,
  archivedHasMore,
  archivedIndexLoading,
  archivedIndexError,
  activeArchivedFilePath,
  archivedSearch,
  archiveSectionOpen,
  onToggleArchiveSection,
  onArchiveSearch,
  onArchiveLoadMore,
  onArchiveSelect,
}: WorkspaceRunTreeProps) {
  const workspaceTreeState = useWorkspaceTreeState({
    datasets,
    recentIndex,
    recentIndexReady,
    activeRunId,
    onSelectRun,
    onSelectRecentRun,
    workspaceIdentityOverrides,
  });

  return (
    <Panel
      panelSlot="run-tree-panel"
      className="flex-1 rounded-none border-r-0 border-t-0 max-[720px]:rounded-[var(--radius-panel)] max-[720px]:border"
    >
      <WorkspaceRunTreeSections
        searchRef={searchRef}
        onOpenImport={onOpenImport}
        archivedIndex={archivedIndex}
        archivedTotal={archivedTotal}
        archivedHasMore={archivedHasMore}
        archivedIndexLoading={archivedIndexLoading}
        archivedIndexError={archivedIndexError}
        activeArchivedFilePath={activeArchivedFilePath}
        archivedSearch={archivedSearch}
        archiveSectionOpen={archiveSectionOpen}
        onToggleArchiveSection={onToggleArchiveSection}
        onArchiveSearch={onArchiveSearch}
        onArchiveLoadMore={onArchiveLoadMore}
        onArchiveSelect={onArchiveSelect}
        {...workspaceTreeState}
      />
    </Panel>
  );
}
