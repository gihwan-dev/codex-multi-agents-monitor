import type { RefObject } from "react";
import type { RunDataset } from "../../../entities/run";
import type {
  ArchivedSessionIndexItem,
  RecentSessionIndexItem,
} from "../../../entities/session-log";
import type { WorkspaceIdentityOverrideMap } from "../../../entities/workspace";
import { Panel } from "../../../shared/ui";
import { useWorkspaceTreeState } from "../model/useWorkspaceTreeState";
import { WorkspaceRunTreeArchiveSection } from "./WorkspaceRunTreeArchiveSection";
import { WorkspaceRunTreeHeader } from "./WorkspaceRunTreeHeader";
import { WorkspaceRunTreeWorkspaceGroup } from "./WorkspaceRunTreeWorkspaceGroup";

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
  const {
    activeTreeId,
    expandedWorkspaceIds,
    handleTreeKeyDown,
    model,
    optimisticActiveRunId,
    search,
    selectRecentRun,
    selectRun,
    setSearch,
    toggleWorkspace,
    treeRef,
  } = useWorkspaceTreeState({
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
      <WorkspaceRunTreeHeader
        onOpenImport={onOpenImport}
        onSearchChange={setSearch}
        search={search}
        searchRef={searchRef}
      />

      <div
        ref={treeRef}
        data-slot="run-tree"
        className="grid min-h-0 flex-1 content-start items-start gap-2 overflow-x-hidden overflow-y-auto pt-2"
        role="tree"
        aria-label="Workspace tree"
        onKeyDown={handleTreeKeyDown}
      >
        {model.workspaces.map((workspace) => (
          <WorkspaceRunTreeWorkspaceGroup
            key={workspace.id}
            activeTreeId={activeTreeId}
            expanded={expandedWorkspaceIds.includes(workspace.id)}
            optimisticActiveRunId={optimisticActiveRunId}
            onSelectRecentRun={selectRecentRun}
            onSelectRun={selectRun}
            onToggleWorkspace={toggleWorkspace}
            workspace={workspace}
          />
        ))}
      </div>

      {archivedIndexError || archivedTotal > 0 || archivedIndex.length > 0 ? (
        <WorkspaceRunTreeArchiveSection
          activeArchivedFilePath={activeArchivedFilePath}
          archiveSectionOpen={archiveSectionOpen}
          archivedHasMore={archivedHasMore}
          archivedIndex={archivedIndex}
          archivedIndexError={archivedIndexError}
          archivedIndexLoading={archivedIndexLoading}
          archivedSearch={archivedSearch}
          archivedTotal={archivedTotal}
          onArchiveLoadMore={onArchiveLoadMore}
          onArchiveSearch={onArchiveSearch}
          onArchiveSelect={onArchiveSelect}
          onToggleArchiveSection={onToggleArchiveSection}
        />
      ) : null}
    </Panel>
  );
}
