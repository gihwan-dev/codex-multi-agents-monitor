import type { LiveConnection, RunDataset } from "../../../entities/run";
import { Badge } from "../../../shared/ui/primitives";

const topBarBadgeClassName = "h-8 rounded-full border-[color:var(--color-chrome-border)] bg-[color:var(--color-surface-tint)] px-3 text-[0.78rem] font-medium";
const LIVE_CONNECTION_LABELS: Record<LiveConnection, string> = { live: "Connected", paused: "Following paused", stale: "Connection stale", reconnected: "Reconnecting…", disconnected: "Disconnected" };

export function LiveModeBadge({
  dataset,
  liveConnection,
}: {
  dataset: RunDataset | null;
  liveConnection: LiveConnection;
}) {
  if (!dataset) {
    return null;
  }

  if (dataset.run.liveMode !== "live") {
    return <Badge variant="outline" className={`${topBarBadgeClassName} text-muted-foreground`}>Imported run</Badge>;
  }

  const liveConnectionLabel = LIVE_CONNECTION_LABELS[liveConnection];

  return (
    <>
      <Badge variant="outline" className={`${topBarBadgeClassName} text-muted-foreground`}>Live watch</Badge>
      <Badge variant="outline" aria-label={`Live connection: ${liveConnectionLabel}`} className={`${topBarBadgeClassName} text-foreground`}>{liveConnectionLabel}</Badge>
    </>
  );
}

export function ArchivedBadge({ dataset }: { dataset: RunDataset | null }) {
  return dataset?.run.isArchived ? (
    <Badge variant="outline" className="h-8 rounded-full border-[color:var(--color-waiting)]/35 bg-[color:color-mix(in_srgb,var(--color-waiting)_8%,transparent)] px-3 text-[0.78rem] font-medium text-[var(--color-waiting)]">
      Archived
    </Badge>
  ) : null;
}
