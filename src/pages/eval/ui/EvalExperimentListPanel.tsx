import type { ExperimentSummary } from "../../../entities/eval";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ScrollArea,
} from "../../../shared/ui/primitives";
import { EvalExperimentListRow } from "./EvalExperimentListRow";

interface EvalExperimentListPanelProps {
  experiments: ExperimentSummary[];
  loading: boolean;
  selectedExperimentId: string | null;
  onSelect: (value: string | null) => void;
}

export function EvalExperimentListPanel({
  experiments,
  loading,
  selectedExperimentId,
  onSelect,
}: EvalExperimentListPanelProps) {
  return (
    <Card className="min-h-0 border-white/8 bg-white/[0.03]">
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          Experiments
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {experiments.length} available
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="min-h-0">
        <ScrollArea className="h-[calc(100vh-16rem)] pr-2 xl:h-full">
          <div className="grid gap-2">
            {experiments.map((item) => (
              <EvalExperimentListRow
                key={item.experiment.id}
                item={item}
                selected={item.experiment.id === selectedExperimentId}
                onSelect={(value) => onSelect(value)}
              />
            ))}
            {!loading && experiments.length === 0 && (
              <p className="rounded-[var(--radius-soft)] border border-dashed border-white/10 px-3 py-4 text-sm leading-6 text-muted-foreground">
                No experiments yet. Create one through the Tauri eval commands and it
                will appear here.
              </p>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
