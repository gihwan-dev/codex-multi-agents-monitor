import type { WorkspaceRunRow } from "../../../entities/run";
import { cn } from "../../../shared/lib";
import { StatusChip } from "../../../shared/ui";

interface WorkspaceRunTreeRunItemProps {
  activeTreeId: string;
  optimisticActiveRunId: string;
  onSelectRecentRun: (workspaceId: string, runId: string, filePath: string) => void;
  onSelectRun: (workspaceId: string, runId: string) => void;
  run: WorkspaceRunRow;
  treeId: string;
  workspaceId: string;
}

export function WorkspaceRunTreeRunItem({
  activeTreeId,
  optimisticActiveRunId,
  onSelectRecentRun,
  onSelectRun,
  run,
  treeId,
  workspaceId,
}: WorkspaceRunTreeRunItemProps) {
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
          onSelectRecentRun(workspaceId, run.id, run.filePath);
          return;
        }

        onSelectRun(workspaceId, run.id);
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
