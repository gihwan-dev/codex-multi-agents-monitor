import type { KeyboardEvent, RefObject } from "react";
import type { WorkspaceTreeModel } from "../../../entities/run";
import type { ArchivedSessionIndexItem } from "../../../entities/session-log";
import { WorkspaceArchiveSection } from "./WorkspaceArchiveSection";
import { WorkspaceRunTreeHeader } from "./WorkspaceRunTreeHeader";
import { WorkspaceTreeList } from "./WorkspaceTreeList";

interface WorkspaceRunTreeSectionsProps {
  searchRef: RefObject<HTMLInputElement | null>;
  search: string;
  setSearch: (value: string) => void;
  onOpenImport: () => void;
  activeTreeId: string;
  expandedWorkspaceIds: string[];
  handleTreeKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  model: WorkspaceTreeModel;
  optimisticActiveRunId: string;
  selectRecentRun: (workspaceId: string, runId: string, filePath: string) => void;
  selectRun: (workspaceId: string, runId: string) => void;
  toggleWorkspace: (workspaceId: string) => void;
  treeRef: RefObject<HTMLDivElement | null>;
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

export function WorkspaceRunTreeSections(props: WorkspaceRunTreeSectionsProps) {
  return (
    <>
      <WorkspaceRunTreeHeader
        searchRef={props.searchRef}
        search={props.search}
        setSearch={props.setSearch}
        onOpenImport={props.onOpenImport}
      />
      <WorkspaceTreeList
        activeTreeId={props.activeTreeId}
        expandedWorkspaceIds={props.expandedWorkspaceIds}
        handleTreeKeyDown={props.handleTreeKeyDown}
        model={props.model}
        optimisticActiveRunId={props.optimisticActiveRunId}
        selectRecentRun={props.selectRecentRun}
        selectRun={props.selectRun}
        toggleWorkspace={props.toggleWorkspace}
        treeRef={props.treeRef}
      />
      <WorkspaceArchiveSection
        archivedIndex={props.archivedIndex}
        archivedTotal={props.archivedTotal}
        archivedHasMore={props.archivedHasMore}
        archivedIndexLoading={props.archivedIndexLoading}
        archivedIndexError={props.archivedIndexError}
        activeArchivedFilePath={props.activeArchivedFilePath}
        archivedSearch={props.archivedSearch}
        archiveSectionOpen={props.archiveSectionOpen}
        onToggleArchiveSection={props.onToggleArchiveSection}
        onArchiveSearch={props.onArchiveSearch}
        onArchiveLoadMore={props.onArchiveLoadMore}
        onArchiveSelect={props.onArchiveSelect}
      />
    </>
  );
}
