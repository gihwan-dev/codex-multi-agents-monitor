import { Button } from "../../../shared/ui/primitives";
import { CurrentScoreBadge } from "./CurrentScoreBadge";

export function SessionScorePanelHeader({
  onOpenEditor,
  recordLabel,
  score,
}: {
  onOpenEditor: () => void;
  recordLabel: string;
  score: number | null;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <CurrentScoreBadge score={score} />
        <span className="text-[0.78rem] text-muted-foreground">{recordLabel}</span>
      </div>
      <Button
        type="button"
        size="xs"
        variant="outline"
        className="border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
        onClick={onOpenEditor}
      >
        {score === null ? "Add score" : "Edit review"}
      </Button>
    </div>
  );
}
