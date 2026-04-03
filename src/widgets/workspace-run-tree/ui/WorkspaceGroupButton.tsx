import { ChevronRight } from "lucide-react";
import type { WorkspaceTreeItem } from "../../../entities/run";
import { cn } from "../../../shared/lib";

interface WorkspaceGroupButtonProps {
  activeTreeId: string;
  expanded: boolean;
  toggleWorkspace: (workspaceId: string) => void;
  treeId: string;
  workspace: WorkspaceTreeItem;
}

export function WorkspaceGroupButton({
  activeTreeId,
  expanded,
  toggleWorkspace,
  treeId,
  workspace,
}: WorkspaceGroupButtonProps) {
  return (
    <button type="button" data-slot="workspace-toggle" data-tree-id={treeId} role="treeitem" aria-level={1} aria-expanded={expanded} tabIndex={activeTreeId === treeId ? 0 : -1} className="flex min-h-7 min-w-0 translate-x-0 items-center rounded-md px-1 py-1 text-left text-muted-foreground transition-[translate,background-color,color] duration-[var(--duration-fast)] ease-[var(--easing-emphasized)] hover:translate-x-0.5 hover:bg-white/[0.03]" onClick={() => toggleWorkspace(workspace.id)}>
      <div className="inline-flex min-w-0 w-full items-center gap-2">
        <ChevronRight className={cn("size-3 shrink-0 transition-transform", expanded && "rotate-90")} aria-hidden="true" />
        <strong data-slot="workspace-name" className="min-w-0 flex-1 truncate text-[0.78rem] font-medium tracking-[0.01em] text-muted-foreground" title={workspace.name}>{workspace.name}</strong>
        <span data-slot="workspace-count" className="ml-auto text-[0.7rem] text-[var(--color-text-tertiary)]">{workspace.runCount}</span>
      </div>
    </button>
  );
}
