import type { WorkspaceTreeItem } from "../../../entities/run";
import { buildWorkspaceTreeId } from "../lib/workspaceTreeUtils";
import { WorkspaceGroupButton } from "./WorkspaceGroupButton";
import { WorkspaceRuns } from "./WorkspaceRuns";
import { useExpandablePresence } from "./workspaceTreeMotion";

interface WorkspaceGroupProps {
  activeTreeId: string;
  expandedWorkspaceIds: string[];
  optimisticActiveRunId: string;
  selectRecentRun: (workspaceId: string, runId: string, filePath: string) => void;
  selectRun: (workspaceId: string, runId: string) => void;
  toggleWorkspace: (workspaceId: string) => void;
  workspace: WorkspaceTreeItem;
}

export function WorkspaceGroup({
  activeTreeId,
  expandedWorkspaceIds,
  optimisticActiveRunId,
  selectRecentRun,
  selectRun,
  toggleWorkspace,
  workspace,
}: WorkspaceGroupProps) {
  const treeId = buildWorkspaceTreeId(workspace.id);
  const expanded = expandedWorkspaceIds.includes(workspace.id);
  const { mounted, state } = useExpandablePresence(expanded);

  return (
    <section data-slot="workspace-group" data-workspace-id={workspace.id} data-expanded={expanded ? "true" : "false"} className="grid gap-1 border-b border-white/6 pb-2">
      <WorkspaceGroupButton activeTreeId={activeTreeId} expanded={expanded} treeId={treeId} workspace={workspace} toggleWorkspace={toggleWorkspace} />
      <div data-slot="workspace-group-body" data-state={state} aria-hidden={!expanded} inert={!expanded ? true : undefined} className="grid grid-rows-[0fr] opacity-0 transition-[grid-template-rows,opacity] duration-[var(--duration-normal)] ease-[var(--easing-emphasized)] motion-reduce:transition-none data-[state=open]:grid-rows-[1fr] data-[state=open]:opacity-100">
        {mounted ? <WorkspaceRuns activeTreeId={activeTreeId} optimisticActiveRunId={optimisticActiveRunId} workspace={workspace} selectRecentRun={selectRecentRun} selectRun={selectRun} /> : null}
      </div>
    </section>
  );
}
