import type { WorkspaceTreeItem } from "../../../entities/run";
import { buildRunTreeId, getWorkspaceRuns } from "../lib/workspaceTreeUtils";
import { WorkspaceRunItem } from "./WorkspaceRunItem";

interface WorkspaceRunsProps {
  activeTreeId: string;
  optimisticActiveRunId: string;
  selectRecentRun: (workspaceId: string, runId: string, filePath: string) => void;
  selectRun: (workspaceId: string, runId: string) => void;
  workspace: WorkspaceTreeItem;
}

export function WorkspaceRuns({
  activeTreeId,
  optimisticActiveRunId,
  selectRecentRun,
  selectRun,
  workspace,
}: WorkspaceRunsProps) {
  return (
    <div data-slot="workspace-group-body-inner" className="min-h-0 overflow-hidden">
      <div data-slot="workspace-runs" className="ml-2 min-w-0 grid gap-1 border-l border-white/8 pl-3">
        {getWorkspaceRuns(workspace).map((run) => (
          <WorkspaceRunItem key={run.id} activeTreeId={activeTreeId} optimisticActiveRunId={optimisticActiveRunId} run={run} treeId={buildRunTreeId(workspace.id, run.id)} workspaceId={workspace.id} selectRecentRun={selectRecentRun} selectRun={selectRun} />
        ))}
      </div>
    </div>
  );
}
