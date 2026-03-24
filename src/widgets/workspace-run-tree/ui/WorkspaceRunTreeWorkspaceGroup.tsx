import { ChevronRight } from "lucide-react";
import type { WorkspaceTreeItem } from "../../../entities/run";
import { cn } from "../../../shared/lib";
import { buildRunTreeId, buildWorkspaceTreeId, getWorkspaceRuns } from "../lib/workspaceTreeUtils";
import { WorkspaceRunTreeRunItem } from "./WorkspaceRunTreeRunItem";

interface WorkspaceRunTreeWorkspaceGroupProps {
  activeTreeId: string;
  expanded: boolean;
  optimisticActiveRunId: string;
  onSelectRecentRun: (workspaceId: string, runId: string, filePath: string) => void;
  onSelectRun: (workspaceId: string, runId: string) => void;
  onToggleWorkspace: (workspaceId: string) => void;
  workspace: WorkspaceTreeItem;
}

export function WorkspaceRunTreeWorkspaceGroup({
  activeTreeId,
  expanded,
  optimisticActiveRunId,
  onSelectRecentRun,
  onSelectRun,
  onToggleWorkspace,
  workspace,
}: WorkspaceRunTreeWorkspaceGroupProps) {
  return (
    <section
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
        onClick={() => onToggleWorkspace(workspace.id)}
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

      {expanded ? (
        <div className="ml-2 min-w-0 grid gap-1 border-l border-white/8 pl-3">
          {getWorkspaceRuns(workspace).map((run) => (
            <WorkspaceRunTreeRunItem
              key={run.id}
              activeTreeId={activeTreeId}
              optimisticActiveRunId={optimisticActiveRunId}
              onSelectRecentRun={onSelectRecentRun}
              onSelectRun={onSelectRun}
              run={run}
              treeId={buildRunTreeId(workspace.id, run.id)}
              workspaceId={workspace.id}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
