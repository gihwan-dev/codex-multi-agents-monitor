import {
  type RefObject,
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  buildWorkspaceTreeModel,
  type QuickFilterSummary,
  type RunDataset,
  type WorkspaceTreeItem,
} from "../../shared/domain";
import { Panel, StatusChip } from "../../shared/ui";

interface WorkspaceRunTreeProps {
  datasets: RunDataset[];
  activeRunId: string;
  onSelectRun: (traceId: string) => void;
  onOpenImport: () => void;
  searchRef: RefObject<HTMLInputElement | null>;
}

interface FlatTreeItem {
  id: string;
  type: "workspace" | "run";
}

export function WorkspaceRunTree({
  datasets,
  activeRunId,
  onSelectRun,
  onOpenImport,
  searchRef,
}: WorkspaceRunTreeProps) {
  const [search, setSearch] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilterSummary["key"]>("all");
  const [expandedWorkspaceIds, setExpandedWorkspaceIds] = useState<string[]>([]);
  const [activeTreeId, setActiveTreeId] = useState<string>(activeRunId);
  const deferredSearch = useDeferredValue(search);
  const treeRef = useRef<HTMLDivElement>(null);
  const model = buildWorkspaceTreeModel(datasets, deferredSearch, quickFilter);

  useEffect(() => {
    setExpandedWorkspaceIds((current) =>
      current.length ? current : model.workspaces.map((workspace) => workspace.id),
    );
    setActiveTreeId(activeRunId);
  }, [activeRunId, model.workspaces]);

  const flatItems = useMemo(() => flattenTree(model.workspaces, expandedWorkspaceIds), [model.workspaces, expandedWorkspaceIds]);

  const focusTreeItem = (itemId: string) => {
    const target = treeRef.current?.querySelector<HTMLElement>(`[data-tree-id="${itemId}"]`);
    target?.focus();
  };

  return (
    <Panel title="Run Workbench" className="run-list run-list--dense">
      <div className="run-list__header">
        <input
          ref={searchRef}
          type="search"
          className="search-input run-list__search"
          placeholder="Search workspaces, threads, runs"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Search workspaces and runs"
        />
        <button type="button" className="button button--ghost" onClick={onOpenImport}>
          Import
        </button>
      </div>

      <div className="run-list__filters">
        {model.quickFilters.map((filter) => (
          <button
            key={filter.key}
            type="button"
            className={`run-list__filter ${quickFilter === filter.key ? "run-list__filter--active" : ""}`.trim()}
            onClick={() => startTransition(() => setQuickFilter(filter.key))}
          >
            <span>{filter.label}</span>
            <strong>{filter.count}</strong>
          </button>
        ))}
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
            flatItems.findIndex((item) => item.id === activeTreeId),
            0,
          );
          const move = (delta: -1 | 1) => {
            const nextIndex = Math.min(Math.max(currentIndex + delta, 0), flatItems.length - 1);
            const next = flatItems[nextIndex];
            if (!next) {
              return;
            }
            setActiveTreeId(next.id);
            focusTreeItem(next.id);
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

          const workspaceId =
            activeItem.type === "workspace" ? activeItem.id : activeItem.id.split(":")[0] ?? "";
          const workspace = model.workspaces.find((item) => item.id === workspaceId);
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

              const firstRun = workspace.threads[0]?.runs[0];
              if (firstRun) {
                const nextId = `${workspace.id}:${firstRun.id}`;
                setActiveTreeId(nextId);
                window.requestAnimationFrame(() => focusTreeItem(nextId));
              }
            }
            return;
          }

          if (event.key === "ArrowLeft") {
            event.preventDefault();
            if (activeItem.type === "run") {
              setActiveTreeId(workspace.id);
              window.requestAnimationFrame(() => focusTreeItem(workspace.id));
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
              onSelectRun(activeItem.id.split(":")[1] ?? activeRunId);
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
                data-tree-id={workspace.id}
                role="treeitem"
                aria-level={1}
                aria-expanded={expanded}
                tabIndex={activeTreeId === workspace.id ? 0 : -1}
                className="run-list__workspace-row"
                title={`${workspace.name}\n${workspace.repoPath}${workspace.badge ? `\n${workspace.badge}` : ""}`}
                onFocus={() => setActiveTreeId(workspace.id)}
                onClick={() =>
                  setExpandedWorkspaceIds((items) =>
                    items.includes(workspace.id)
                      ? items.filter((workspaceId) => workspaceId !== workspace.id)
                      : [...items, workspace.id],
                  )
                }
              >
                <div className="run-list__workspace-copy">
                  <strong>{workspace.name}</strong>
                  <span>{expanded ? "v" : ">"}</span>
                </div>
                <span className="run-list__workspace-count">{workspace.runCount}</span>
              </button>

              {expanded ? (
                <div className="run-list__thread-list">
                  {workspace.threads.map((thread) => (
                    <section key={thread.id} className="run-list__thread">
                      <header className="run-list__thread-header">
                        <strong>{thread.title}</strong>
                      </header>
                      <div className="run-list__runs">
                        {thread.runs.map((run) => {
                          const treeId = `${workspace.id}:${run.id}`;
                          return (
                            <button
                              key={run.id}
                              type="button"
                              data-tree-id={treeId}
                              role="treeitem"
                              aria-level={2}
                              tabIndex={activeTreeId === treeId ? 0 : -1}
                              className={`run-row ${activeRunId === run.id ? "run-row--active" : ""}`.trim()}
                              onFocus={() => setActiveTreeId(treeId)}
                              onClick={() => onSelectRun(run.id)}
                            >
                              <div className="run-row__title">
                                <strong>{run.title}</strong>
                                <StatusChip status={run.status} subtle />
                              </div>
                              <p className="run-row__subtitle">{run.lastEventSummary}</p>
                              <div className="run-row__meta">
                                <span>{run.liveMode === "live" ? "Live" : "Imported"}</span>
                                <span>{run.relativeTime}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </Panel>
  );
}

function flattenTree(workspaces: WorkspaceTreeItem[], expandedWorkspaceIds: string[]): FlatTreeItem[] {
  return workspaces.flatMap((workspace) => [
    { id: workspace.id, type: "workspace" as const },
    ...(expandedWorkspaceIds.includes(workspace.id)
      ? workspace.threads.flatMap((thread) =>
          thread.runs.map((run) => ({
            id: `${workspace.id}:${run.id}`,
            type: "run" as const,
          })),
        )
      : []),
  ]);
}
