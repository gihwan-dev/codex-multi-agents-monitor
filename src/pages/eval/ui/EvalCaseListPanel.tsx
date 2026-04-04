import type { EvalCase, ExperimentDetail } from "../../../entities/eval";
import { Card, CardContent, CardHeader, CardTitle, ScrollArea } from "../../../shared/ui/primitives";

interface EvalCaseListPanelProps {
  detail: ExperimentDetail | null;
  error?: string | null;
  detailLoading: boolean;
  selectedCaseId: string | null;
  onSelect: (value: string | null) => void;
}

function casePanelSubtitle(detail: ExperimentDetail | null, detailLoading: boolean) {
  return detailLoading ? "Loading experiment detail…" : `${detail?.cases.length ?? 0} case(s)`;
}

function CaseRow({
  item,
  selected,
  runCount,
  onSelect,
}: {
  item: EvalCase;
  selected: boolean;
  runCount: number;
  onSelect: (value: string) => void;
}) {
  return (
    <button
      type="button"
      aria-label={`Select case: ${item.title}`}
      className={`grid gap-1 rounded-[var(--radius-soft)] border px-3 py-3 text-left transition-colors motion-reduce:transition-none ${
        selected
          ? "border-[color:color-mix(in_srgb,var(--color-active)_50%,white_15%)] bg-[color:color-mix(in_srgb,var(--color-active)_12%,transparent)]"
          : "border-white/8 bg-black/10 hover:bg-white/[0.05]"
      }`}
      onClick={() => onSelect(item.id)}
    >
      <span className="text-sm font-medium text-foreground">{item.title}</span>
      <span className="line-clamp-2 text-xs leading-5 text-muted-foreground" title={item.expectedResult}>
        {item.expectedResult}
      </span>
      <span className="text-xs text-muted-foreground">{runCount} runs</span>
    </button>
  );
}

function CaseListContent({
  detail,
  error,
  detailLoading,
  onSelect,
  selectedCaseId,
}: EvalCaseListPanelProps) {
  if (detailLoading) {
    return (
      <div className="grid gap-2">
        <div className="h-16 animate-pulse rounded-[var(--radius-soft)] bg-white/[0.03] motion-reduce:animate-none" />
        <div className="h-16 animate-pulse rounded-[var(--radius-soft)] bg-white/[0.03] motion-reduce:animate-none" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-[var(--radius-soft)] border border-destructive/40 bg-destructive/5 px-3 py-4 text-sm leading-6 text-destructive">
        {error}
      </p>
    );
  }

  if (detail === null) {
    return (
      <p className="rounded-[var(--radius-soft)] border border-dashed border-white/10 px-3 py-4 text-sm leading-6 text-muted-foreground">
        Select an experiment to view its cases.
      </p>
    );
  }

  if (detail.cases.length === 0) {
    return (
      <p className="rounded-[var(--radius-soft)] border border-dashed border-white/10 px-3 py-4 text-sm leading-6 text-muted-foreground">
        Add a case with `add_case` before comparing candidates.
      </p>
    );
  }

  return (
    <>
      {detail?.cases.map((item) => (
        <CaseRow
          key={item.id}
          item={item}
          selected={item.id === selectedCaseId}
          runCount={detail.runs.filter((run) => run.caseId === item.id).length}
          onSelect={(value) => onSelect(value)}
        />
      ))}
    </>
  );
}

export function EvalCaseListPanel(props: EvalCaseListPanelProps) {
  return (
    <Card className="min-h-0 border-white/8 bg-white/[0.03]">
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          Cases
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {casePanelSubtitle(props.detail, props.detailLoading)}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid min-h-0 gap-4">
        <ScrollArea className="h-[16rem] pr-2 xl:h-full">
          <div className="grid gap-2">
            <CaseListContent {...props} />
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
