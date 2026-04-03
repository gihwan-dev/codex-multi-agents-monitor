import { formatScoredAt } from "./sessionScoreFormatting";

export function SessionScorePanelSummary({
  note,
  scoredAt,
  scoredBy,
}: {
  note: string | null;
  scoredAt: string | null;
  scoredBy: string | null;
}) {
  return (
    <div className="grid gap-2 text-[0.78rem]">
      <p className="text-muted-foreground">
        {scoredBy ? `${scoredBy} · ${formatScoredAt(scoredAt)}` : "Not scored yet"}
      </p>
      <p className="leading-6 text-foreground/90">
        {note ??
          "Capture what improved, what regressed, and whether this profile is worth reusing."}
      </p>
    </div>
  );
}
