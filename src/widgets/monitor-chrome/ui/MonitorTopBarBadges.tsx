import type { LiveConnection, RunDataset } from "../../../entities/run";
import { Badge } from "../../../shared/ui/primitives";

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
    return <Badge variant="outline" className="h-8 rounded-full border-[color:var(--color-chrome-border)] bg-[color:var(--color-surface-tint)] px-3 text-[0.78rem] font-medium text-muted-foreground">Imported run</Badge>;
  }

  return (
    <>
      <Badge variant="outline" className="h-8 rounded-full border-[color:var(--color-chrome-border)] bg-[color:var(--color-surface-tint)] px-3 text-[0.78rem] font-medium text-muted-foreground">Live watch</Badge>
      <Badge variant="outline" className="h-8 rounded-full border-[color:var(--color-chrome-border)] bg-[color:var(--color-surface-tint)] px-3 text-[0.78rem] font-medium text-foreground">{liveConnection === "paused" ? "Following paused" : liveConnection}</Badge>
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
