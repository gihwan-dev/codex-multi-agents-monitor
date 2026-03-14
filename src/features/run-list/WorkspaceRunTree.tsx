import {
  type RefObject,
  startTransition,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from "react";
import { formatDuration, type RunDataset, type RunStatus } from "../../shared/domain";
import { Panel, StatusChip } from "../../shared/ui";

type QuickFilter = "all" | "live" | "waiting" | "failed";

interface WorkspaceRunTreeProps {
  datasets: RunDataset[];
  activeRunId: string;
  onSelectRun: (traceId: string) => void;
  onOpenImport: () => void;
  searchRef: RefObject<HTMLInputElement | null>;
}

interface TreeWorkspace {
  id: string;
  name: string;
  badge: string | null;
  repoPath: string;
  threads: Array<{
    id: string;
    title: string;
    owner: string;
    runs: Array<{
      id: string;
      title: string;
      subtitle: string;
      status: RunStatus;
      liveMode: RunDataset["run"]["liveMode"];
      metrics: string;
      relativeTime: string;
    }>;
  }>;
  runCount: number;
}

export function WorkspaceRunTree({
  datasets,
  activeRunId,
  onSelectRun,
  onOpenImport,
  searchRef,
}: WorkspaceRunTreeProps) {
  const [search, setSearch] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [expandedWorkspaceIds, setExpandedWorkspaceIds] = useState<string[]>([]);
  const [activeTreeId, setActiveTreeId] = useState<string>(activeRunId);
  const deferredSearch = useDeferredValue(search);
  const treeRef = useRef<HTMLDivElement>(null);
  const workspaces = buildWorkspaces(datasets, activeRunId, deferredSearch, quickFilter);
  const filters = buildQuickFilters(datasets);
  const flatItems = flattenTree(workspaces, expandedWorkspaceIds);

  useEffect(() => {
    setExpandedWorkspaceIds((current) =>
      current.length ? current : workspaces.map((workspace) => workspace.id),
    );
    setActiveTreeId(activeRunId);
  }, [activeRunId, workspaces]);

  const focusTreeItem = (itemId: string) => {
    const target = treeRef.current?.querySelector<HTMLElement>(`[data-tree-id="${itemId}"]`);
    target?.focus();
  };

  return (
    <Panel title="Run Workbench" className="run-list">
      <div className="run-list__header">
        <input
          ref={searchRef}
          type="search"
          className="search-input run-list__search"
          placeholder="Search workspaces /"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Search workspaces and runs"
        />
        <button type="button" className="button button--ghost" onClick={onOpenImport}>
          Import
        </button>
      </div>

      <div className="run-list__filters">
        {filters.map((filter) => (
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
            if (next) {
              setActiveTreeId(next.id);
              focusTreeItem(next.id);
            }
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
          const workspaceId = activeItem?.id.split(":")[0];
          const workspace = workspaces.find((item) => item.id === workspaceId);

          if (event.key === "ArrowRight" && workspace) {
            event.preventDefault();
            if (!expandedWorkspaceIds.includes(workspace.id)) {
              setExpandedWorkspaceIds((items) => [...items, workspace.id]);
              return;
            }
            if (activeItem?.id === workspace.id) {
              const firstRun = workspace.threads[0]?.runs[0];
              if (firstRun) {
                const firstRunId = `${workspace.id}:${firstRun.id}`;
                setActiveTreeId(firstRunId);
                window.requestAnimationFrame(() => focusTreeItem(firstRunId));
              }
            }
            return;
          }

          if (event.key === "ArrowLeft" && workspace) {
            event.preventDefault();
            if (activeItem?.id !== workspace.id) {
              setActiveTreeId(workspace.id);
              window.requestAnimationFrame(() => focusTreeItem(workspace.id));
              return;
            }
            setExpandedWorkspaceIds((items) =>
              items.filter((workspaceItemId) => workspaceItemId !== workspace.id),
            );
            return;
          }

          if (event.key === "Enter" && activeItem) {
            event.preventDefault();
            if (activeItem.id.includes(":")) {
              onSelectRun(activeItem.id.split(":")[1] ?? activeRunId);
              return;
            }
            setExpandedWorkspaceIds((items) =>
              items.includes(activeItem.id)
                ? items.filter((workspaceItemId) => workspaceItemId !== activeItem.id)
                : [...items, activeItem.id],
            );
          }
        }}
      >
        {workspaces.map((workspace) => {
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
                onFocus={() => setActiveTreeId(workspace.id)}
                onClick={() =>
                  setExpandedWorkspaceIds((items) =>
                    items.includes(workspace.id)
                      ? items.filter((workspaceId) => workspaceId !== workspace.id)
                      : [...items, workspace.id],
                  )
                }
              >
                <div>
                  <div className="run-list__workspace-title">
                    <strong>{workspace.name}</strong>
                    {workspace.badge ? <span className="run-list__workspace-badge">{workspace.badge}</span> : null}
                  </div>
                  <p>{workspace.repoPath}</p>
                </div>
                <span>{workspace.runCount}</span>
              </button>

              {expanded ? (
                <fieldset
                  className="run-list__thread-group"
                  aria-label={`${workspace.name} threads`}
                >
                  {workspace.threads.map((thread) => (
                    <section key={thread.id} className="run-list__thread">
                      <header className="run-list__thread-header">
                        <strong>{thread.title}</strong>
                        <span>{thread.owner}</span>
                      </header>
                      <div className="run-list__runs">
                        {thread.runs.map((run) => (
                          <button
                            key={run.id}
                            type="button"
                            data-tree-id={`${workspace.id}:${run.id}`}
                            role="treeitem"
                            aria-level={2}
                            tabIndex={activeTreeId === `${workspace.id}:${run.id}` ? 0 : -1}
                            className={`run-row ${activeRunId === run.id ? "run-row--active" : ""}`.trim()}
                            onFocus={() => setActiveTreeId(`${workspace.id}:${run.id}`)}
                            onClick={() => onSelectRun(run.id)}
                          >
                            <div className="run-row__title">
                              <strong>{run.title}</strong>
                              <StatusChip status={run.status} subtle />
                            </div>
                            <p className="run-row__subtitle">{run.subtitle}</p>
                            <div className="run-row__meta">
                              <span>{run.metrics}</span>
                              <span>{run.liveMode === "live" ? "Live" : run.relativeTime}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </section>
                  ))}
                </fieldset>
              ) : null}
            </section>
          );
        })}
      </div>
    </Panel>
  );
}

function buildQuickFilters(datasets: RunDataset[]) {
  return [
    { key: "all" as const, label: "All", count: datasets.length },
    { key: "live" as const, label: "Live", count: datasets.filter((dataset) => dataset.run.liveMode === "live").length },
    { key: "waiting" as const, label: "Waiting", count: datasets.filter((dataset) => ["waiting", "blocked", "interrupted"].includes(dataset.run.status)).length },
    { key: "failed" as const, label: "Failed", count: datasets.filter((dataset) => dataset.run.status === "failed").length },
  ];
}

function buildWorkspaces(
  datasets: RunDataset[],
  activeRunId: string,
  searchTerm: string,
  quickFilter: QuickFilter,
): TreeWorkspace[] {
  const referenceTs = Math.max(...datasets.map((dataset) => dataset.run.startTs));
  const workspaceMap = new Map<string, TreeWorkspace>();

  for (const dataset of datasets) {
    if (!matchesQuickFilter(dataset, quickFilter) || !matchesSearch(dataset, searchTerm)) {
      continue;
    }
    const workspace = workspaceMap.get(dataset.project.projectId) ?? {
      id: dataset.project.projectId,
      name: dataset.project.name,
      badge: dataset.project.badge ?? null,
      repoPath: dataset.project.repoPath,
      threads: [],
      runCount: 0,
    };
    let thread = workspace.threads.find((item) => item.id === dataset.session.sessionId);
    if (!thread) {
      thread = {
        id: dataset.session.sessionId,
        title: dataset.session.title,
        owner: dataset.session.owner,
        runs: [],
      };
      workspace.threads.push(thread);
    }
    thread.runs.push({
      id: dataset.run.traceId,
      title: dataset.run.title,
      subtitle: `${dataset.session.title} · ${dataset.session.owner}`,
      status: dataset.run.status,
      liveMode: dataset.run.liveMode,
      metrics: `${dataset.run.summaryMetrics.agentCount} ag · ${formatDuration(dataset.run.summaryMetrics.totalDurationMs)}`,
      relativeTime: formatRelativeTime(dataset.run.startTs, referenceTs),
    });
    workspace.runCount += 1;
    workspaceMap.set(dataset.project.projectId, workspace);
  }

  const workspaces = [...workspaceMap.values()].sort((left, right) => left.name.localeCompare(right.name));
  for (const workspace of workspaces) {
    workspace.threads.sort((left, right) => left.title.localeCompare(right.title));
    for (const thread of workspace.threads) {
      thread.runs.sort((left, right) =>
        left.id === activeRunId
          ? -1
          : right.id === activeRunId
            ? 1
            : right.id.localeCompare(left.id),
      );
    }
  }
  return workspaces;
}

function matchesQuickFilter(dataset: RunDataset, quickFilter: QuickFilter) {
  if (quickFilter === "all") return true;
  if (quickFilter === "live") return dataset.run.liveMode === "live";
  if (quickFilter === "waiting") return ["waiting", "blocked", "interrupted"].includes(dataset.run.status);
  return dataset.run.status === "failed";
}

function matchesSearch(dataset: RunDataset, searchTerm: string) {
  if (!searchTerm) return true;
  return [dataset.project.name, dataset.session.title, dataset.session.owner, dataset.run.title, dataset.run.traceId]
    .join(" ")
    .toLowerCase()
    .includes(searchTerm.toLowerCase());
}

function formatRelativeTime(timestamp: number, referenceTs: number) {
  const delta = Math.max(referenceTs - timestamp, 0);
  if (delta < 60_000) return "just now";
  const minutes = Math.round(delta / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function flattenTree(workspaces: TreeWorkspace[], expandedWorkspaceIds: string[]) {
  const items: Array<{ id: string }> = [];
  for (const workspace of workspaces) {
    items.push({ id: workspace.id });
    if (!expandedWorkspaceIds.includes(workspace.id)) continue;
    for (const thread of workspace.threads) {
      for (const run of thread.runs) {
        items.push({ id: `${workspace.id}:${run.id}` });
      }
    }
  }
  return items;
}
