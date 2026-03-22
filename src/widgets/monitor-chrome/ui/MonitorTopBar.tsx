import type { LiveConnection, RunDataset } from "../../../entities/run";
import { StatusChip } from "../../../shared/ui";
import { Badge, Button } from "../../../shared/ui/primitives";

interface MonitorTopBarProps {
  actionsDisabled?: boolean;
  dataset: RunDataset | null;
  followLive: boolean;
  liveConnection: LiveConnection;
  onExport: (target: HTMLElement) => void;
  onToggleFollowLive: () => void;
  onToggleShortcuts: (target?: HTMLElement | null) => void;
}

export function MonitorTopBar({
  actionsDisabled = false,
  dataset,
  followLive,
  liveConnection,
  onExport,
  onToggleFollowLive,
  onToggleShortcuts,
}: MonitorTopBarProps) {
  if (!dataset) {
    return (
      <header className="grid gap-3 rounded-t-[calc(var(--radius-panel)+4px)] border border-white/8 bg-[linear-gradient(180deg,rgba(18,22,31,0.96),rgba(13,17,24,0.96))] px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="grid min-w-0 gap-1.5">
          <p className="text-[0.7rem] uppercase tracking-[0.08em] text-muted-foreground">
            Graph-first run workbench
          </p>
          <p className="truncate text-[0.82rem] text-muted-foreground">
            Ready to inspect
          </p>
          <div className="grid gap-1">
            <h1 className="min-w-0 truncate text-[clamp(1.18rem,2vw,1.5rem)] font-semibold">
              Select a run
            </h1>
            <p className="text-[0.82rem] text-muted-foreground">
              Select a recent or archived run to inspect.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled
            className="border-white/10 bg-white/[0.03] text-foreground hover:bg-white/[0.06]"
          >
            Follow live
          </Button>
          <Button type="button" disabled className="bg-primary text-primary-foreground">
            Export
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-white/10 bg-white/[0.03] text-foreground hover:bg-white/[0.06]"
            onClick={(event) => onToggleShortcuts(event.currentTarget)}
          >
            Help
          </Button>
        </div>
      </header>
    );
  }

  return (
    <header className="grid gap-3 rounded-t-[calc(var(--radius-panel)+4px)] border border-white/8 bg-[linear-gradient(180deg,rgba(18,22,31,0.96),rgba(13,17,24,0.96))] px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div className="grid min-w-0 gap-1.5">
        <p className="text-[0.7rem] uppercase tracking-[0.08em] text-muted-foreground">
          Graph-first run workbench
        </p>
        <p className="truncate text-[0.82rem] text-muted-foreground">
          {dataset.project.name} / {dataset.session.title}
        </p>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h1 className="min-w-0 truncate text-[clamp(1.18rem,2vw,1.5rem)] font-semibold">
            {dataset.run.title}
          </h1>
          <StatusChip status={dataset.run.status} />
          <Badge
            variant="outline"
            className="h-8 rounded-full border-white/8 bg-white/[0.04] px-3 text-[0.78rem] font-medium text-muted-foreground"
          >
            {dataset.run.liveMode === "live" ? "Live watch" : "Imported run"}
          </Badge>
          {dataset.run.isArchived ? (
            <Badge
              variant="outline"
              className="h-8 rounded-full border-[color:var(--color-waiting)]/35 bg-[color:color-mix(in_srgb,var(--color-waiting)_8%,transparent)] px-3 text-[0.78rem] font-medium text-[var(--color-waiting)]"
            >
              Archived
            </Badge>
          ) : null}
          {dataset.run.liveMode === "live" ? (
            <Badge
              variant="outline"
              className="h-8 rounded-full border-white/10 bg-white/[0.04] px-3 text-[0.78rem] font-medium text-foreground"
            >
              {liveConnection === "paused" ? "Following paused" : liveConnection}
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant={followLive ? "default" : "outline"}
          disabled={actionsDisabled || dataset.run.liveMode !== "live"}
          onClick={onToggleFollowLive}
          className={
            followLive
              ? "bg-[color:color-mix(in_srgb,var(--color-active)_18%,transparent)] text-foreground hover:bg-[color:color-mix(in_srgb,var(--color-active)_24%,transparent)]"
              : "border-white/10 bg-white/[0.03] text-foreground hover:bg-white/[0.06]"
          }
        >
          {dataset.run.liveMode === "live" && liveConnection === "paused"
            ? "Resume follow"
            : "Follow live"}
        </Button>
        <Button
          type="button"
          disabled={actionsDisabled}
          onClick={(event) => onExport(event.currentTarget)}
          className="bg-primary text-primary-foreground"
        >
          Export
        </Button>
        <Button
          type="button"
          variant="outline"
          className="border-white/10 bg-white/[0.03] text-foreground hover:bg-white/[0.06]"
          onClick={(event) => onToggleShortcuts(event.currentTarget)}
        >
          Help
        </Button>
      </div>
    </header>
  );
}
