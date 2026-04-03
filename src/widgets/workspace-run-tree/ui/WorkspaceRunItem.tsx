import type { WorkspaceRunRow } from "../../../entities/run";
import { cn } from "../../../shared/lib";
import { StatusChip } from "../../../shared/ui";
import { resolveProviderBadge } from "../lib/providerBadge";
import { ScoreBadge } from "./ScoreBadge";

interface WorkspaceRunItemProps {
  activeTreeId: string;
  optimisticActiveRunId: string;
  run: WorkspaceRunRow;
  treeId: string;
  workspaceId: string;
  selectRecentRun: (workspaceId: string, runId: string, filePath: string) => void;
  selectRun: (workspaceId: string, runId: string) => void;
}

export function WorkspaceRunItem({
  activeTreeId,
  optimisticActiveRunId,
  run,
  treeId,
  workspaceId,
  selectRecentRun,
  selectRun,
}: WorkspaceRunItemProps) {
  const active = optimisticActiveRunId === run.id;
  const providerBadge = resolveProviderBadge(run.provider);

  return (
    <button type="button" data-slot="run-tree-item" data-run-id={run.id} data-active={active ? "true" : "false"} data-tree-id={treeId} role="treeitem" aria-level={2} tabIndex={activeTreeId === treeId ? 0 : -1} className={cn("grid min-w-0 translate-x-0 gap-1 rounded-md px-2 py-1.5 text-left text-[0.82rem] text-muted-foreground transition-[translate,background-color,color] duration-[var(--duration-fast)] ease-[var(--easing-emphasized)] hover:translate-x-0.5 hover:bg-white/[0.04] hover:text-foreground data-[active=true]:translate-x-0.5", active && "bg-[color:color-mix(in_srgb,var(--color-active)_8%,transparent)] text-foreground")} onClick={() => (run.filePath ? selectRecentRun(workspaceId, run.id, run.filePath) : selectRun(workspaceId, run.id))} title={run.title}>
      <div className="flex min-w-0 items-center gap-2">
        <strong data-slot="run-title" className="block min-w-0 flex-1 truncate text-sm font-semibold">{run.title}</strong>
        {providerBadge ? (
          <span
            className={cn(
              "inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.12em]",
              providerBadge.className,
            )}
            role="img"
            aria-label={providerBadge.label}
            title={providerBadge.label}
          >
            {providerBadge.short}
          </span>
        ) : null}
        <ScoreBadge score={run.score} compact showEmptyLabel={false} />
        <StatusChip status={run.status} subtle />
      </div>
      <div className="flex min-w-0 items-center gap-1 text-[0.72rem] text-[var(--color-text-tertiary)]">
        <span className="shrink-0">{run.relativeTime}</span>
        <span className="shrink-0">·</span>
        <span className="truncate">
          {run.profileLabel ? `${run.profileLabel} · ${run.lastEventSummary}` : run.lastEventSummary}
        </span>
      </div>
    </button>
  );
}
