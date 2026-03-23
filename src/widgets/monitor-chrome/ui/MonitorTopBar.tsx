import type { LiveConnection, RunDataset } from "../../../entities/run";
import { ThemePreferenceSelect } from "../../../shared/theme";
import { StatusChip } from "../../../shared/ui";
import { Badge, Button } from "../../../shared/ui/primitives";

const chromeActionClassName =
  "border-[color:var(--color-chrome-border)] bg-[color:var(--color-surface-tint)] text-foreground hover:bg-[color:var(--color-surface-hover)]";
const headerClassName =
  "grid gap-3 rounded-t-[calc(var(--radius-panel)+4px)] border px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center";
const headerStyle = {
  background: "var(--gradient-monitor-header)",
  borderColor: "var(--color-chrome-border)",
};

interface MonitorTopBarProps {
  actionsDisabled?: boolean;
  dataset: RunDataset | null;
  followLive: boolean;
  liveConnection: LiveConnection;
  onExport: (target: HTMLElement) => void;
  onToggleFollowLive: () => void;
  onToggleShortcuts: (target?: HTMLElement | null) => void;
}

function MonitorTopBarShell({
  actions,
  children,
}: {
  actions: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <header className={headerClassName} style={headerStyle}>
      {children}
      {actions}
    </header>
  );
}

function EmptyMonitorTopBarHeading() {
  return (
    <div className="grid min-w-0 gap-1.5">
      <p className="text-[0.7rem] uppercase tracking-[0.08em] text-muted-foreground">
        Graph-first run workbench
      </p>
      <p className="truncate text-[0.82rem] text-muted-foreground">Ready to inspect</p>
      <div className="grid gap-1">
        <h1 className="min-w-0 truncate text-[clamp(1.18rem,2vw,1.5rem)] font-semibold">
          Select a run
        </h1>
        <p className="text-[0.82rem] text-muted-foreground">
          Select a recent or archived run to inspect.
        </p>
      </div>
    </div>
  );
}

function LiveModeBadge({
  dataset,
  liveConnection,
}: Pick<MonitorTopBarProps, "dataset" | "liveConnection">) {
  if (!dataset) {
    return null;
  }

  if (dataset.run.liveMode !== "live") {
    return (
      <Badge
        variant="outline"
        className="h-8 rounded-full border-[color:var(--color-chrome-border)] bg-[color:var(--color-surface-tint)] px-3 text-[0.78rem] font-medium text-muted-foreground"
      >
        Imported run
      </Badge>
    );
  }

  return (
    <>
      <Badge
        variant="outline"
        className="h-8 rounded-full border-[color:var(--color-chrome-border)] bg-[color:var(--color-surface-tint)] px-3 text-[0.78rem] font-medium text-muted-foreground"
      >
        Live watch
      </Badge>
      <Badge
        variant="outline"
        className="h-8 rounded-full border-[color:var(--color-chrome-border)] bg-[color:var(--color-surface-tint)] px-3 text-[0.78rem] font-medium text-foreground"
      >
        {liveConnection === "paused" ? "Following paused" : liveConnection}
      </Badge>
    </>
  );
}

function ArchivedBadge({ dataset }: Pick<MonitorTopBarProps, "dataset">) {
  if (!dataset?.run.isArchived) {
    return null;
  }

  return (
    <Badge
      variant="outline"
      className="h-8 rounded-full border-[color:var(--color-waiting)]/35 bg-[color:color-mix(in_srgb,var(--color-waiting)_8%,transparent)] px-3 text-[0.78rem] font-medium text-[var(--color-waiting)]"
    >
      Archived
    </Badge>
  );
}

function DatasetMonitorTopBarHeading({
  dataset,
  liveConnection,
}: Pick<MonitorTopBarProps, "dataset" | "liveConnection">) {
  if (!dataset) {
    return null;
  }

  return (
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
        <LiveModeBadge dataset={dataset} liveConnection={liveConnection} />
        <ArchivedBadge dataset={dataset} />
      </div>
    </div>
  );
}

function resolveFollowLiveLabel(dataset: RunDataset | null, followLive: boolean) {
  return dataset?.run.liveMode === "live" && !followLive ? "Resume follow" : "Follow live";
}

function resolveFollowLiveButtonClassName(followLive: boolean) {
  return followLive
    ? "bg-[color:color-mix(in_srgb,var(--color-active)_18%,transparent)] text-foreground hover:bg-[color:color-mix(in_srgb,var(--color-active)_24%,transparent)]"
    : chromeActionClassName;
}

function MonitorTopBarActions({
  actionsDisabled = false,
  dataset,
  followLive,
  onExport,
  onToggleFollowLive,
  onToggleShortcuts,
}: Omit<MonitorTopBarProps, "liveConnection">) {
  const followLiveDisabled = actionsDisabled || dataset?.run.liveMode !== "live";

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button
        type="button"
        variant={followLive ? "default" : "outline"}
        disabled={followLiveDisabled}
        onClick={onToggleFollowLive}
        className={resolveFollowLiveButtonClassName(followLive)}
      >
        {resolveFollowLiveLabel(dataset, followLive)}
      </Button>
      <Button
        type="button"
        disabled={actionsDisabled || !dataset}
        onClick={(event) => {
          if (dataset) {
            onExport(event.currentTarget);
          }
        }}
        className="bg-primary text-primary-foreground"
      >
        Export
      </Button>
      <ThemePreferenceSelect />
      <Button
        type="button"
        variant="outline"
        className={chromeActionClassName}
        onClick={(event) => onToggleShortcuts(event.currentTarget)}
      >
        Help
      </Button>
    </div>
  );
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
  return (
    <MonitorTopBarShell
      actions={
        <MonitorTopBarActions
          actionsDisabled={actionsDisabled}
          dataset={dataset}
          followLive={followLive}
          onExport={onExport}
          onToggleFollowLive={onToggleFollowLive}
          onToggleShortcuts={onToggleShortcuts}
        />
      }
    >
      {dataset ? (
        <DatasetMonitorTopBarHeading
          dataset={dataset}
          liveConnection={liveConnection}
        />
      ) : (
        <EmptyMonitorTopBarHeading />
      )}
    </MonitorTopBarShell>
  );
}
