import type { LiveConnection, RunDataset } from "../../../entities/run";
import { StatusChip } from "../../../shared/ui";

interface MonitorTopBarProps {
  dataset: RunDataset;
  followLive: boolean;
  liveConnection: LiveConnection;
  onExport: (target: HTMLElement) => void;
  onToggleFollowLive: () => void;
  onToggleShortcuts: () => void;
}

export function MonitorTopBar({
  dataset,
  followLive,
  liveConnection,
  onExport,
  onToggleFollowLive,
  onToggleShortcuts,
}: MonitorTopBarProps) {
  return (
    <header className="top-bar top-bar--compact">
      <div className="top-bar__identity">
        <p className="eyebrow">Graph-first run workbench</p>
        <p className="top-bar__breadcrumb">
          {dataset.project.name} / {dataset.session.title}
        </p>
        <div className="top-bar__title-row">
          <h1>{dataset.run.title}</h1>
          <StatusChip status={dataset.run.status} />
          <span className="env-badge">
            {dataset.run.liveMode === "live" ? "Live watch" : "Imported run"}
          </span>
          {dataset.run.isArchived ? (
            <span className="env-badge env-badge--archived">Archived</span>
          ) : null}
          {dataset.run.liveMode === "live" ? (
            <span className={`live-badge live-badge--${liveConnection}`}>
              {liveConnection === "paused" ? "Following paused" : liveConnection}
            </span>
          ) : null}
        </div>
      </div>

      <div className="top-bar__controls">
        <button
          type="button"
          className={`button ${followLive ? "button--active" : "button--ghost"}`.trim()}
          disabled={dataset.run.liveMode !== "live"}
          onClick={onToggleFollowLive}
        >
          Follow live
        </button>
        <button type="button" className="button" onClick={(event) => onExport(event.currentTarget)}>
          Export
        </button>
        <button type="button" className="button button--ghost" onClick={onToggleShortcuts}>
          Help
        </button>
      </div>
    </header>
  );
}
