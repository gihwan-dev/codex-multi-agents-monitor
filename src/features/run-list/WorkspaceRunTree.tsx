import {
  type RefObject,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type ArchivedSessionIndexItem,
  buildWorkspaceTreeModel,
  type RunDataset,
  type WorkspaceIdentityOverrideMap,
  type WorkspaceTreeItem,
} from "../../shared/domain";
import { Panel, StatusChip } from "../../shared/ui";
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

interface FlatTreeItem {
  treeId: string;
  workspaceId: string;
  type: "workspace" | "run";
  runId?: string;
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
  const [search, setSearch] = useState("");
  const [expandedWorkspaceIds, setExpandedWorkspaceIds] = useState<string[]>([]);
  const [activeTreeId, setActiveTreeId] = useState<string>("");
  const deferredSearch = useDeferredValue(search);
  const treeRef = useRef<HTMLDivElement>(null);
  const model = buildWorkspaceTreeModel(
    datasets,
    deferredSearch,
    "all",
    workspaceIdentityOverrides,
  );

  useEffect(() => {
    setExpandedWorkspaceIds((current) => {
      const nextExpanded = current.filter((workspaceId) =>
        model.workspaces.some((workspace) => workspace.id === workspaceId),
      );
      const fallbackExpanded = model.workspaces.map((workspace) => workspace.id);
      const resolvedExpanded = nextExpanded.length ? nextExpanded : fallbackExpanded;

      return areWorkspaceIdsEqual(current, resolvedExpanded) ? current : resolvedExpanded;
    });
    setActiveTreeId((current) => {
      const nextTreeId =
        findRunTreeId(model.workspaces, activeRunId) ??
        buildWorkspaceTreeId(model.workspaces[0]?.id ?? "");
      return current === nextTreeId ? current : nextTreeId;
    });
  }, [activeRunId, model.workspaces]);

  const flatItems = useMemo(
    () => flattenTree(model.workspaces, expandedWorkspaceIds),
    [model.workspaces, expandedWorkspaceIds],
  );

  const focusTreeItem = (itemId: string) => {
    const target = treeRef.current?.querySelector<HTMLElement>(`[data-tree-id="${itemId}"]`);
    target?.focus();
  };

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
        onKeyDown={(event) => {
          if (!flatItems.length) {
            return;
          }

          const currentIndex = Math.max(
            flatItems.findIndex((item) => item.treeId === activeTreeId),
            0,
          );
          const move = (delta: -1 | 1) => {
            const nextIndex = Math.min(Math.max(currentIndex + delta, 0), flatItems.length - 1);
            const next = flatItems[nextIndex];
            if (!next) {
              return;
            }
            setActiveTreeId(next.treeId);
            focusTreeItem(next.treeId);
          };

          if (event.key === "ArrowDown") {
            event.preventDefault();
            move(1);
            return;
          }

          if (event.key === "ArrowUp") {
            event.preventDefault();
            move(-1);
            return;
          }

          const activeItem = flatItems[currentIndex];
          if (!activeItem) {
            return;
          }

          const workspace = model.workspaces.find((item) => item.id === activeItem.workspaceId);
          if (!workspace) {
            return;
          }

          if (event.key === "ArrowRight") {
            event.preventDefault();
            if (activeItem.type === "workspace") {
              if (!expandedWorkspaceIds.includes(workspace.id)) {
                setExpandedWorkspaceIds((items) => [...items, workspace.id]);
                return;
              }

              const firstRun = getWorkspaceRuns(workspace)[0];
              if (firstRun) {
                const nextId = buildRunTreeId(workspace.id, firstRun.id);
                setActiveTreeId(nextId);
                window.requestAnimationFrame(() => focusTreeItem(nextId));
              }
            }
            return;
          }

          if (event.key === "ArrowLeft") {
            event.preventDefault();
            if (activeItem.type === "run") {
              const workspaceTreeId = buildWorkspaceTreeId(workspace.id);
              setActiveTreeId(workspaceTreeId);
              window.requestAnimationFrame(() => focusTreeItem(workspaceTreeId));
              return;
            }

            setExpandedWorkspaceIds((items) =>
              items.filter((workspaceItemId) => workspaceItemId !== workspace.id),
            );
            return;
          }

          if (event.key === "Enter") {
            event.preventDefault();
            if (activeItem.type === "run") {
              onSelectRun(activeItem.runId ?? activeRunId);
              return;
            }

            setExpandedWorkspaceIds((items) =>
              items.includes(workspace.id)
                ? items.filter((workspaceItemId) => workspaceItemId !== workspace.id)
                : [...items, workspace.id],
            );
          }
        }}
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
                  setActiveTreeId(buildWorkspaceTreeId(workspace.id));
                  setExpandedWorkspaceIds((items) =>
                    items.includes(workspace.id)
                      ? items.filter((workspaceId) => workspaceId !== workspace.id)
                      : [...items, workspace.id],
                  );
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
                          setActiveTreeId(treeId);
                          onSelectRun(run.id);
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

function flattenTree(workspaces: WorkspaceTreeItem[], expandedWorkspaceIds: string[]): FlatTreeItem[] {
  return workspaces.flatMap((workspace) => [
    {
      treeId: buildWorkspaceTreeId(workspace.id),
      workspaceId: workspace.id,
      type: "workspace" as const,
    },
    ...(expandedWorkspaceIds.includes(workspace.id)
      ? getWorkspaceRuns(workspace).map((run) => ({
          treeId: buildRunTreeId(workspace.id, run.id),
          workspaceId: workspace.id,
          type: "run" as const,
          runId: run.id,
        }))
      : []),
  ]);
}

function areWorkspaceIdsEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function getWorkspaceRuns(workspace: WorkspaceTreeItem) {
  return workspace.threads.flatMap((thread) => thread.runs);
}

function buildWorkspaceTreeId(workspaceId: string) {
  return `workspace-${encodeURIComponent(workspaceId)}`;
}

function buildRunTreeId(workspaceId: string, runId: string) {
  return `run-${encodeURIComponent(workspaceId)}-${encodeURIComponent(runId)}`;
}

function findRunTreeId(workspaces: WorkspaceTreeItem[], activeRunId: string) {
  for (const workspace of workspaces) {
    const run = getWorkspaceRuns(workspace).find((item) => item.id === activeRunId);
    if (run) {
      return buildRunTreeId(workspace.id, run.id);
    }
  }

  return null;
}
