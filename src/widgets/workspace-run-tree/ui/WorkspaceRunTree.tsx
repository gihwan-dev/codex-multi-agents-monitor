import { ChevronRight } from "lucide-react";
import type { RefObject } from "react";
import type { RunDataset } from "../../../entities/run";
import type {
  ArchivedSessionIndexItem,
  RecentSessionIndexItem,
} from "../../../entities/session-log";
import type { WorkspaceIdentityOverrideMap } from "../../../entities/workspace";
import { cn } from "../../../shared/lib";
import { Panel, StatusChip } from "../../../shared/ui";
import { Button, Input } from "../../../shared/ui/primitives";
import { buildRunTreeId, buildWorkspaceTreeId, getWorkspaceRuns } from "../lib/workspaceTreeUtils";
import { useWorkspaceTreeState } from "../model/useWorkspaceTreeState";
import { ArchivedSessionList } from "./ArchivedSessionList";

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
      <div
        data-slot="run-tree-header"
        className="grid gap-2 border-b border-white/8 pb-3 md:grid-cols-[minmax(0,1fr)_auto]"
      >
        <Input
          ref={searchRef}
          type="search"
          className="border-white/10 bg-white/[0.03] text-foreground"
          placeholder="Search workspaces and runs"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Search workspaces and runs"
        />
        <Button
          type="button"
          variant="outline"
          className="border-white/10 bg-white/[0.03] text-foreground hover:bg-white/[0.06]"
          onClick={onOpenImport}
        >
          Import
        </Button>
      </div>

      <div
        ref={treeRef}
        data-slot="run-tree"
        className="grid min-h-0 flex-1 content-start items-start gap-2 overflow-x-hidden overflow-y-auto pt-2"
        role="tree"
        aria-label="Workspace tree"
        onKeyDown={handleTreeKeyDown}
      >
        {model.workspaces.map((workspace) => {
          const expanded = expandedWorkspaceIds.includes(workspace.id);
          return (
            <section
              key={workspace.id}
              data-slot="workspace-group"
              data-workspace-id={workspace.id}
              className="grid gap-1 border-b border-white/6 pb-2"
            >
              <button
                type="button"
                data-slot="workspace-toggle"
                data-tree-id={buildWorkspaceTreeId(workspace.id)}
                role="treeitem"
                aria-level={1}
                aria-expanded={expanded}
                tabIndex={activeTreeId === buildWorkspaceTreeId(workspace.id) ? 0 : -1}
                className="flex min-h-7 min-w-0 items-center rounded-md px-1 py-1 text-left text-muted-foreground transition-colors hover:bg-white/[0.03]"
                onClick={() => {
                  toggleWorkspace(workspace.id);
                }}
              >
                <div className="inline-flex min-w-0 w-full items-center gap-2">
                  <ChevronRight
                    className={cn(
                      "size-3 shrink-0 transition-transform",
                      expanded && "rotate-90",
                    )}
                    aria-hidden="true"
                  />
                  <strong
                    data-slot="workspace-name"
                    className="min-w-0 flex-1 truncate text-[0.78rem] font-medium tracking-[0.01em] text-muted-foreground"
                    title={workspace.name}
                  >
                    {workspace.name}
                  </strong>
                  <span
                    data-slot="workspace-count"
                    className="ml-auto text-[0.7rem] text-[var(--color-text-tertiary)]"
                  >
                    {workspace.runCount}
                  </span>
                </div>
              </button>

              {expanded ? (
                <div className="ml-2 min-w-0 grid gap-1 border-l border-white/8 pl-3">
                  {getWorkspaceRuns(workspace).map((run) => {
                    const treeId = buildRunTreeId(workspace.id, run.id);
                    return (
                      <button
                        key={run.id}
                        type="button"
                        data-slot="run-tree-item"
                        data-run-id={run.id}
                        data-active={optimisticActiveRunId === run.id ? "true" : "false"}
                        data-tree-id={treeId}
                        role="treeitem"
                        aria-level={2}
                        tabIndex={activeTreeId === treeId ? 0 : -1}
                        className={cn(
                          "grid min-w-0 gap-1 rounded-md px-2 py-1.5 text-left text-[0.82rem] text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground",
                          optimisticActiveRunId === run.id &&
                            "bg-[color:color-mix(in_srgb,var(--color-active)_8%,transparent)] text-foreground",
                        )}
                        onClick={() => {
                          if (run.filePath) {
                            selectRecentRun(workspace.id, run.id, run.filePath);
                            return;
                          }
                          selectRun(workspace.id, run.id);
                        }}
                        title={run.title}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <strong
                            data-slot="run-title"
                            className="block min-w-0 flex-1 truncate text-sm font-semibold"
                          >
                            {run.title}
                          </strong>
                          <StatusChip status={run.status} subtle />
                        </div>
                        <div className="flex min-w-0 items-center gap-1 text-[0.72rem] text-[var(--color-text-tertiary)]">
                          <span className="shrink-0">{run.relativeTime}</span>
                          <span className="shrink-0">·</span>
                          <span className="truncate">{run.lastEventSummary}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      {archivedIndexError || archivedTotal > 0 || archivedIndex.length > 0 ? (
        <section
          data-slot="archive-section"
          className="mt-1 border-t border-white/8 pt-2"
        >
          <button
            type="button"
            data-slot="archive-section-toggle"
            className="flex min-h-7 w-full items-center gap-2 rounded-md px-1 py-1 text-left text-muted-foreground transition-colors hover:bg-white/[0.03]"
            onClick={onToggleArchiveSection}
            aria-expanded={archiveSectionOpen}
          >
            <ChevronRight
              className={cn(
                "size-3 transition-transform",
                archiveSectionOpen && "rotate-90",
              )}
              aria-hidden="true"
            />
            <span className="text-[0.78rem] font-medium tracking-[0.01em]">
              Archive
            </span>
            <span
              data-slot="archive-count"
              className="ml-auto text-[0.7rem] text-[var(--color-text-tertiary)]"
            >
              {archivedTotal}
            </span>
          </button>

          {archiveSectionOpen ? (
            <ArchivedSessionList
              items={archivedIndex}
              total={archivedTotal}
              hasMore={archivedHasMore}
              indexLoading={archivedIndexLoading}
              errorMessage={archivedIndexError}
              activeFilePath={activeArchivedFilePath}
              search={archivedSearch}
              onSearch={onArchiveSearch}
              onLoadMore={onArchiveLoadMore}
              onSelect={onArchiveSelect}
            />
          ) : null}
        </section>
      ) : null}
    </Panel>
  );
}
