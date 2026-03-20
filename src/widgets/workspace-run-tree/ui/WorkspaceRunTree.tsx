import type { RefObject } from "react";
import type {
  ArchivedSessionIndexItem,
  RunDataset,
  WorkspaceIdentityOverrideMap,
} from "../../../entities/run";
import { Panel, StatusChip } from "../../../shared/ui";
import "./workspace-run-tree.css";
import { buildRunTreeId, buildWorkspaceTreeId, getWorkspaceRuns } from "../lib/workspaceTreeUtils";
import { useWorkspaceTreeState } from "../model/useWorkspaceTreeState";
import { ArchivedSessionList } from "./ArchivedSessionList";

interface WorkspaceRunTreeProps {
  datasets: RunDataset[];
  activeRunId: string;
  onSelectRun: (traceId: string) => void;
  onOpenImport: () => void;
  searchRef: RefObject<HTMLInputElement | null>;
  workspaceIdentityOverrides: WorkspaceIdentityOverrideMap;
  archivedIndex: ArchivedSessionIndexItem[];
  archivedTotal: number;
  archivedHasMore: boolean;
  archivedLoading: boolean;
  archivedSearch: string;
  archiveSectionOpen: boolean;
  onToggleArchiveSection: () => void;
  onArchiveSearch: (query: string) => void;
  onArchiveLoadMore: () => void;
  onArchiveSelect: (filePath: string) => void;
}

export function WorkspaceRunTree({
  datasets,
  activeRunId,
  onSelectRun,
  onOpenImport,
  searchRef,
  workspaceIdentityOverrides,
  archivedIndex,
  archivedTotal,
  archivedHasMore,
  archivedLoading,
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
    search,
    selectRun,
    setSearch,
    toggleWorkspace,
    treeRef,
  } = useWorkspaceTreeState({
    datasets,
    activeRunId,
    onSelectRun,
    workspaceIdentityOverrides,
  });

  return (
    <Panel className="run-list run-list--dense">
      <div className="run-list__header">
        <input
          ref={searchRef}
          type="search"
          className="search-input run-list__search"
          placeholder="Search workspaces and runs"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Search workspaces and runs"
        />
        <button type="button" className="button button--ghost" onClick={onOpenImport}>
          Import
        </button>
      </div>

      <div
        ref={treeRef}
        className="run-list__tree"
        role="tree"
        aria-label="Workspace tree"
        onKeyDown={handleTreeKeyDown}
      >
        {model.workspaces.map((workspace) => {
          const expanded = expandedWorkspaceIds.includes(workspace.id);
          return (
            <section key={workspace.id} className="run-list__workspace">
              <button
                type="button"
                data-tree-id={buildWorkspaceTreeId(workspace.id)}
                role="treeitem"
                aria-level={1}
                aria-expanded={expanded}
                tabIndex={activeTreeId === buildWorkspaceTreeId(workspace.id) ? 0 : -1}
                className="run-list__workspace-row"
                onClick={() => {
                  toggleWorkspace(workspace.id);
                }}
              >
                <div className="run-list__workspace-copy">
                  <span
                    className={`run-list__disclosure${expanded ? " run-list__disclosure--open" : ""}`}
                    aria-hidden="true"
                  />
                  <strong className="run-list__workspace-name" title={workspace.name}>
                    {workspace.name}
                  </strong>
                  <span className="run-list__workspace-count">{workspace.runCount}</span>
                </div>
              </button>

              {expanded ? (
                <div className="run-list__runs">
                  {getWorkspaceRuns(workspace).map((run) => {
                    const treeId = buildRunTreeId(workspace.id, run.id);
                    return (
                      <button
                        key={run.id}
                        type="button"
                        data-tree-id={treeId}
                        role="treeitem"
                        aria-level={2}
                        tabIndex={activeTreeId === treeId ? 0 : -1}
                        className={`run-row ${activeRunId === run.id ? "run-row--active" : ""}`.trim()}
                        onClick={() => {
                          selectRun(workspace.id, run.id);
                        }}
                        title={run.title}
                      >
                        <div className="run-row__title">
                          <strong>{run.title}</strong>
                          <StatusChip status={run.status} subtle />
                        </div>
                        <div className="run-row__sub">
                          <span className="run-row__meta">{run.relativeTime}</span>
                          <span className="run-row__sub-sep">·</span>
                          <span className="run-row__summary">{run.lastEventSummary}</span>
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

      {archivedTotal > 0 || archivedIndex.length > 0 ? (
        <section className="archive-section">
          <button
            type="button"
            className="archive-section__header"
            onClick={onToggleArchiveSection}
            aria-expanded={archiveSectionOpen}
          >
            <span
              className={`run-list__disclosure${archiveSectionOpen ? " run-list__disclosure--open" : ""}`}
              aria-hidden="true"
            />
            <span className="archive-section__title">Archive</span>
            <span className="run-list__workspace-count">{archivedTotal}</span>
          </button>

          {archiveSectionOpen ? (
            <ArchivedSessionList
              items={archivedIndex}
              total={archivedTotal}
              hasMore={archivedHasMore}
              loading={archivedLoading}
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
