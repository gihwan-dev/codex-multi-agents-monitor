import type { RunDataset } from "../../../entities/run";
import { ThemePreferenceSelect } from "../../../shared/theme";
import { Button } from "../../../shared/ui/primitives";
import { chromeActionClassName } from "./monitorTopBarStyles";

interface MonitorTopBarActionsProps {
  actionsDisabled?: boolean;
  dataset: RunDataset | null;
  followLive: boolean;
  onExport: (target: HTMLElement) => void;
  onToggleFollowLive: () => void;
  onToggleShortcuts: (target?: HTMLElement | null) => void;
}

function resolveFollowLiveLabel(dataset: RunDataset | null, followLive: boolean) {
  return dataset?.run.liveMode === "live" && !followLive ? "Resume follow" : "Follow live";
}

function resolveFollowLiveButtonClassName(followLive: boolean) {
  return followLive
    ? "bg-[color:color-mix(in_srgb,var(--color-active)_18%,transparent)] text-foreground hover:bg-[color:color-mix(in_srgb,var(--color-active)_24%,transparent)]"
    : chromeActionClassName;
}

export function MonitorTopBarActions({
  actionsDisabled = false,
  dataset,
  followLive,
  onExport,
  onToggleFollowLive,
  onToggleShortcuts,
}: MonitorTopBarActionsProps) {
  const followLiveDisabled = actionsDisabled || dataset?.run.liveMode !== "live";

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button type="button" variant={followLive ? "default" : "outline"} disabled={followLiveDisabled} onClick={onToggleFollowLive} className={resolveFollowLiveButtonClassName(followLive)}>
        {resolveFollowLiveLabel(dataset, followLive)}
      </Button>
      <Button type="button" disabled={actionsDisabled || !dataset} onClick={(event) => dataset && onExport(event.currentTarget)} className="bg-primary text-primary-foreground">
        Export
      </Button>
      <ThemePreferenceSelect />
      <Button type="button" variant="outline" className={chromeActionClassName} onClick={(event) => onToggleShortcuts(event.currentTarget)}>
        Help
      </Button>
    </div>
  );
}
