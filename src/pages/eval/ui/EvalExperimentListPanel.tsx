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
  error?: string | null;
  experiments: ExperimentSummary[];
  loading: boolean;
  selectedExperimentId: string | null;
  onSelect: (value: string | null) => void;
}

const ExperimentListSkeleton = () => {
  return (
    <div className="grid gap-2">
      <div className="h-16 animate-pulse rounded-[var(--radius-soft)] bg-white/[0.03] motion-reduce:animate-none" />
      <div className="h-16 animate-pulse rounded-[var(--radius-soft)] bg-white/[0.03] motion-reduce:animate-none" />
    </div>
  );
};

const ExperimentListEmptyState = () => {
  return (
    <p className="rounded-[var(--radius-soft)] border border-dashed border-white/10 px-3 py-4 text-sm leading-6 text-muted-foreground">
      No experiments yet. Create one through the Tauri eval commands and it will
      appear here.
    </p>
  );
};

const ExperimentListErrorState = ({ message }: { message: string }) => (
  <p className="rounded-[var(--radius-soft)] border border-destructive/40 bg-destructive/5 px-3 py-4 text-sm leading-6 text-destructive">
    {message}
  </p>
);

const getExperimentListVisibility = ({
  error,
  isEmpty,
  loading,
}: Pick<EvalExperimentListPanelProps, "error" | "loading"> & {
  isEmpty: boolean;
}) => {
  const showSkeleton = loading && isEmpty;
  const showError = !loading && !!error;
  const showEmpty = !loading && !error && isEmpty;

  return {
    showEmpty,
    showError,
    showSkeleton,
  };
};

export function EvalExperimentListPanel({
  error,
  experiments,
  loading,
  selectedExperimentId,
  onSelect,
}: EvalExperimentListPanelProps) {
  const isEmpty = experiments.length === 0;
  const errorMessage = error ?? "";
  const { showEmpty, showError, showSkeleton } = getExperimentListVisibility({
    error,
    isEmpty,
    loading,
  });

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
            {showSkeleton && <ExperimentListSkeleton />}
            {showError && <ExperimentListErrorState message={errorMessage} />}
            {experiments.map((item) => (
              <EvalExperimentListRow
                key={item.experiment.id}
                item={item}
                selected={item.experiment.id === selectedExperimentId}
                onSelect={onSelect}
              />
            ))}
            {showEmpty && <ExperimentListEmptyState />}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
