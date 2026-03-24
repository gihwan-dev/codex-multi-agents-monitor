import type { LiveConnection, RunDataset } from "../../../entities/run";
import { DatasetMonitorTopBarHeading } from "./DatasetMonitorTopBarHeading";
import { EmptyMonitorTopBarHeading } from "./EmptyMonitorTopBarHeading";
import { MonitorTopBarActions } from "./MonitorTopBarActions";
import { MonitorTopBarShell } from "./MonitorTopBarShell";

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
        <DatasetMonitorTopBarHeading dataset={dataset} liveConnection={liveConnection} />
      ) : (
        <EmptyMonitorTopBarHeading />
      )}
    </MonitorTopBarShell>
  );
}
