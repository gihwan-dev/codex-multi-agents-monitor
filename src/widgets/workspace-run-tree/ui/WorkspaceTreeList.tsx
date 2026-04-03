import {
  type KeyboardEvent,
  type RefObject,
  useEffect,
} from "react";
import type { WorkspaceTreeModel } from "../../../entities/run";
import { ScrollArea } from "../../../shared/ui/primitives";
import { WorkspaceGroup } from "./WorkspaceGroup";
import { scrollTreeItemIntoView } from "./workspaceTreeMotion";

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
  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      scrollTreeItemIntoView(treeRef, activeTreeId);
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [activeTreeId, treeRef]);

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div
        ref={treeRef}
        data-slot="run-tree"
        className="grid content-start items-start gap-2 pr-3 pt-2"
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
    </ScrollArea>
  );
}
