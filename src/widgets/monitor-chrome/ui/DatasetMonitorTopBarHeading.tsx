import type { LiveConnection, RunDataset } from "../../../entities/run";
import { StatusChip } from "../../../shared/ui";
import { ArchivedBadge, LiveModeBadge } from "./MonitorTopBarBadges";

interface DatasetMonitorTopBarHeadingProps {
  dataset: RunDataset;
  liveConnection: LiveConnection;
}

export function DatasetMonitorTopBarHeading({
  dataset,
  liveConnection,
}: DatasetMonitorTopBarHeadingProps) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <p className="text-[0.7rem] uppercase tracking-[0.08em] text-muted-foreground">Graph-first run workbench</p>
      <p
        className="truncate text-[0.82rem] text-muted-foreground"
        title={`${dataset.project.name} / ${dataset.session.title}`}
      >
        {dataset.project.name} / {dataset.session.title}
      </p>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <h1
          className="min-w-0 truncate text-[clamp(1.18rem,2vw,1.5rem)] font-semibold"
          title={dataset.run.title}
        >
          {dataset.run.title}
        </h1>
        <StatusChip status={dataset.run.status} />
        <LiveModeBadge dataset={dataset} liveConnection={liveConnection} />
        <ArchivedBadge dataset={dataset} />
      </div>
    </div>
  );
}
