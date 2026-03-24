import { ChevronRight } from "lucide-react";
import type { KeyboardEvent, RefObject } from "react";
import type {
  WorkspaceRunRow,
  WorkspaceTreeItem,
  WorkspaceTreeModel,
} from "../../../entities/run";
import { cn } from "../../../shared/lib";
import { StatusChip } from "../../../shared/ui";
import { buildRunTreeId, buildWorkspaceTreeId, getWorkspaceRuns } from "../lib/workspaceTreeUtils";

interface WorkspaceTreeListProps {
  activeTreeId: string;
  expandedWorkspaceIds: string[];
  handleTreeKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  model: WorkspaceTreeModel;
  optimisticActiveRunId: string;
  selectRecentRun: (workspaceId: string, runId: string, filePath: string) => void;
  selectRun: (workspaceId: string, runId: string) => void;
  toggleWorkspace: (workspaceId: string) => void;
  treeRef: RefObject<HTMLDivElement | null>;
}

function WorkspaceRunItem({
  activeTreeId,
  optimisticActiveRunId,
  run,
  treeId,
  workspaceId,
  selectRecentRun,
  selectRun,
}: {
  activeTreeId: string;
  optimisticActiveRunId: string;
  run: WorkspaceRunRow;
  treeId: string;
  workspaceId: string;
  selectRecentRun: WorkspaceTreeListProps["selectRecentRun"];
  selectRun: WorkspaceTreeListProps["selectRun"];
}) {
  return (
    <button
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
          selectRecentRun(workspaceId, run.id, run.filePath);
          return;
        }

        selectRun(workspaceId, run.id);
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
}

function WorkspaceGroupButton({
  activeTreeId,
  expanded,
  treeId,
  workspace,
  toggleWorkspace,
}: {
  activeTreeId: string;
  expanded: boolean;
  treeId: string;
  workspace: WorkspaceTreeItem;
  toggleWorkspace: (workspaceId: string) => void;
}) {
  return (
    <button
      type="button"
      data-slot="workspace-toggle"
      data-tree-id={treeId}
      role="treeitem"
      aria-level={1}
      aria-expanded={expanded}
      tabIndex={activeTreeId === treeId ? 0 : -1}
      className="flex min-h-7 min-w-0 items-center rounded-md px-1 py-1 text-left text-muted-foreground transition-colors hover:bg-white/[0.03]"
      onClick={() => toggleWorkspace(workspace.id)}
    >
      <div className="inline-flex min-w-0 w-full items-center gap-2">
        <ChevronRight
          className={cn("size-3 shrink-0 transition-transform", expanded && "rotate-90")}
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
  );
}

function WorkspaceRuns({
  activeTreeId,
  optimisticActiveRunId,
  selectRecentRun,
  selectRun,
  workspace,
}: Pick<
  WorkspaceTreeListProps,
  "activeTreeId" | "optimisticActiveRunId" | "selectRecentRun" | "selectRun"
> & {
  workspace: WorkspaceTreeItem;
}) {
  return (
    <div className="ml-2 min-w-0 grid gap-1 border-l border-white/8 pl-3">
      {getWorkspaceRuns(workspace).map((run) => (
        <WorkspaceRunItem
          key={run.id}
          activeTreeId={activeTreeId}
          optimisticActiveRunId={optimisticActiveRunId}
          run={run}
          treeId={buildRunTreeId(workspace.id, run.id)}
          workspaceId={workspace.id}
          selectRecentRun={selectRecentRun}
          selectRun={selectRun}
        />
      ))}
    </div>
  );
}

function WorkspaceGroup({
  activeTreeId,
  expandedWorkspaceIds,
  optimisticActiveRunId,
  workspace,
  toggleWorkspace,
  selectRecentRun,
  selectRun,
}: Pick<
  WorkspaceTreeListProps,
  | "activeTreeId"
  | "expandedWorkspaceIds"
  | "optimisticActiveRunId"
  | "toggleWorkspace"
  | "selectRecentRun"
  | "selectRun"
> & {
  workspace: WorkspaceTreeItem;
}) {
  const treeId = buildWorkspaceTreeId(workspace.id);
  const expanded = expandedWorkspaceIds.includes(workspace.id);

  return (
    <section
      data-slot="workspace-group"
      data-workspace-id={workspace.id}
      className="grid gap-1 border-b border-white/6 pb-2"
    >
      <WorkspaceGroupButton
        activeTreeId={activeTreeId}
        expanded={expanded}
        treeId={treeId}
        workspace={workspace}
        toggleWorkspace={toggleWorkspace}
      />
      {expanded ? (
        <WorkspaceRuns
          activeTreeId={activeTreeId}
          optimisticActiveRunId={optimisticActiveRunId}
          workspace={workspace}
          selectRecentRun={selectRecentRun}
          selectRun={selectRun}
        />
      ) : null}
    </section>
  );
}

export function WorkspaceTreeList({
  activeTreeId,
  expandedWorkspaceIds,
  handleTreeKeyDown,
  model,
  optimisticActiveRunId,
  selectRecentRun,
  selectRun,
  toggleWorkspace,
  treeRef,
}: WorkspaceTreeListProps) {
  return (
    <div
      ref={treeRef}
      data-slot="run-tree"
      className="grid min-h-0 flex-1 content-start items-start gap-2 overflow-x-hidden overflow-y-auto pt-2"
      role="tree"
      aria-label="Workspace tree"
      onKeyDown={handleTreeKeyDown}
    >
      {model.workspaces.map((workspace) => (
        <WorkspaceGroup
          key={workspace.id}
          activeTreeId={activeTreeId}
          expandedWorkspaceIds={expandedWorkspaceIds}
          optimisticActiveRunId={optimisticActiveRunId}
          workspace={workspace}
          toggleWorkspace={toggleWorkspace}
          selectRecentRun={selectRecentRun}
          selectRun={selectRun}
        />
      ))}
    </div>
  );
}
