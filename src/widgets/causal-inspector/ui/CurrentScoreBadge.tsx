import { cn } from "../../../shared/lib";
import { Badge } from "../../../shared/ui/primitives";
import { resolveSessionScoreTone } from "./sessionScoreFormatting";

export function CurrentScoreBadge({ score }: { score: number | null }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "border px-2 py-0.5 text-[0.72rem] font-semibold tabular-nums",
        resolveSessionScoreTone(score),
      )}
    >
      {score === null ? "Unscored" : `${score}/100`}
    </Badge>
  );
}
