import type { LiveConnection, RunDataset } from "../../../entities/run";
import { type ThemePreference, useTheme } from "../../../shared/theme";
import { StatusChip } from "../../../shared/ui";
import {
  Badge,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../shared/ui/primitives";

const THEME_OPTIONS: Array<{ label: string; value: ThemePreference }> = [
  { label: "System", value: "system" },
  { label: "Dark", value: "dark" },
  { label: "Light", value: "light" },
];

const chromeActionClassName =
  "border-[color:var(--color-chrome-border)] bg-[color:var(--color-surface-tint)] text-foreground hover:bg-[color:var(--color-surface-hover)]";

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
  const { preference, setPreference } = useTheme();

  if (!dataset) {
    return (
      <header
        className="grid gap-3 rounded-t-[calc(var(--radius-panel)+4px)] border px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
        style={{
          background: "var(--gradient-monitor-header)",
          borderColor: "var(--color-chrome-border)",
        }}
      >
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
            className={chromeActionClassName}
          >
            Follow live
          </Button>
          <Button type="button" disabled className="bg-primary text-primary-foreground">
            Export
          </Button>
          <ThemePreferenceSelect
            preference={preference}
            onChange={setPreference}
          />
          <Button
            type="button"
            variant="outline"
            className={chromeActionClassName}
            onClick={(event) => onToggleShortcuts(event.currentTarget)}
          >
            Help
          </Button>
        </div>
      </header>
    );
  }

  return (
    <header
      className="grid gap-3 rounded-t-[calc(var(--radius-panel)+4px)] border px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
      style={{
        background: "var(--gradient-monitor-header)",
        borderColor: "var(--color-chrome-border)",
      }}
    >
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
            className="h-8 rounded-full border-[color:var(--color-chrome-border)] bg-[color:var(--color-surface-tint)] px-3 text-[0.78rem] font-medium text-muted-foreground"
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
              className="h-8 rounded-full border-[color:var(--color-chrome-border)] bg-[color:var(--color-surface-tint)] px-3 text-[0.78rem] font-medium text-foreground"
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
              : chromeActionClassName
          }
        >
          {dataset.run.liveMode === "live" && !followLive
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
        <ThemePreferenceSelect
          preference={preference}
          onChange={setPreference}
        />
        <Button
          type="button"
          variant="outline"
          className={chromeActionClassName}
          onClick={(event) => onToggleShortcuts(event.currentTarget)}
        >
          Help
        </Button>
      </div>
    </header>
  );
}

function ThemePreferenceSelect({
  preference,
  onChange,
}: {
  preference: ThemePreference;
  onChange: (preference: ThemePreference) => void;
}) {
  return (
    <Select
      value={preference}
      onValueChange={(value) => onChange(value as ThemePreference)}
    >
      <SelectTrigger
        size="sm"
        aria-label="Theme"
        className="min-w-[10.5rem] border-[color:var(--color-chrome-border)] bg-[color:var(--color-surface-tint)] text-foreground hover:bg-[color:var(--color-surface-hover)]"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="text-[0.68rem] uppercase tracking-[0.05em] text-muted-foreground">
            Theme
          </span>
          <SelectValue />
        </span>
      </SelectTrigger>
      <SelectContent className="min-w-[10.5rem]">
        {THEME_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
