import type { ProfileRevision } from "../../../entities/session-log";
import { cn } from "../../../shared/lib";

export function RevisionSummary({
  currentRevision,
  revisions,
}: {
  currentRevision: string | null;
  revisions: ProfileRevision[];
}) {
  if (revisions.length === 0) {
    return <p className="text-[0.78rem] text-muted-foreground">No scored revisions yet.</p>;
  }

  return (
    <div className="grid gap-2">
      {revisions.slice(0, 5).map((revision) => (
        <div
          key={revision.revision}
          className={cn(
            "grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-md border border-white/8 bg-white/[0.03] px-2 py-1.5 text-[0.75rem]",
            currentRevision === revision.revision && "border-white/18 bg-white/[0.06]",
          )}
        >
          <span className="truncate">{revision.label}</span>
          <span className="tabular-nums text-muted-foreground">{revision.sessionCount} runs</span>
          <span className="tabular-nums text-muted-foreground">
            {revision.averageScore === null
              ? "Unscored"
              : `${Math.round(revision.averageScore)}/100`}
          </span>
        </div>
      ))}
    </div>
  );
}
